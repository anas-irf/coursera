"""Certificates: issued by the application when a course is completed with a passing grade.

Nothing here calls a service: the student takes the course through the API, the instructor
grades through the API, and the certificate appears (or does not) as a consequence.
"""
import re
from datetime import timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

CERTIFICATES = '/api/v1/certificates/'
NUMBER = re.compile(r'^CERT-[0-9A-F]{8}-[0-9A-F]{10}$')


def attempt_url(quiz):
    return f'/api/v1/assessments/quizzes/{quiz.uuid}/attempt/'


def take_quiz(client, bundle, correct):
    """Start and submit an attempt answering the questions in ``correct`` right."""
    attempt_id = client.post(attempt_url(bundle.quiz), {'action': 'start'}, format='json').json()['attempt_id']
    r = client.post(attempt_url(bundle.quiz), {
        'action': 'submit', 'attempt_id': attempt_id,
        'answers': f.build_answers(bundle.quiz, correct)}, format='json')
    assert r.status_code == 200
    return r.json()['results']['score']


def hand_in(client, bundle):
    r = client.post(f'/api/v1/assessments/assignments/{bundle.assignment.uuid}/submit/',
                    {'submission_text': 'my work'}, format='multipart')
    assert r.status_code == 200


def grade(instructor_client, bundle, student, points):
    submission = f.AssignmentSubmission.objects.get(assignment=bundle.assignment, student=student)
    r = instructor_client.post(
        f'/api/v1/assessments/instructor/submissions/{submission.uuid}/grade/',
        {'grade': points, 'feedback': 'ok'}, format='json')
    assert r.status_code == 200


def complete_reading_and_video(client, bundle):
    for lecture in (bundle.video, bundle.reading):
        r = client.post(f'/api/v1/learning/courses/{bundle.course.uuid}/lectures/{lecture.uuid}/complete/')
        assert r.status_code == 200


@pytest.fixture
def course(instructor):
    """Quiz (40 %, two questions) and assignment (60 %); passing is 60."""
    return f.build_course(instructor, status='published',
                          quiz_questions=[f.mc_question(), f.tf_question()])


def certificates_of(student):
    return f.Certificate.objects.filter(student=student)


def finish_without_a_grade_yet(client, bundle, quiz_correct=(0, 1)):
    complete_reading_and_video(client, bundle)
    take_quiz(client, bundle, list(quiz_correct))
    hand_in(client, bundle)


# --------------------------------------------------------------------------- #
# earning one
# --------------------------------------------------------------------------- #
def test_the_certificate_arrives_when_the_last_assignment_is_graded(
        auth_client, instructor, student, course):
    f.enroll(student, course.course)
    client = auth_client(student)

    finish_without_a_grade_yet(client, course)

    # the course is completed, but a hand-in is waiting for its grade
    assert f.reload(f.Enrollment.objects.get(student=student, course=course.course)).status == 'completed'
    assert certificates_of(student).count() == 0

    grade(auth_client(instructor), course, student, 90)

    (certificate,) = certificates_of(student)
    assert certificate.final_grade == Decimal('94.00')          # (100 * 40 + 90 * 60) / 100
    assert NUMBER.match(certificate.certificate_number)
    assert re.fullmatch(r'[0-9a-f]{20}', certificate.verification_code)
    enrollment = f.Enrollment.objects.get(student=student, course=course.course)
    assert enrollment.certificate_issued is True
    assert enrollment.certificate_issued_date == certificate.issue_date
    assert certificate.completion_date == enrollment.completed_date

    listed = client.get(CERTIFICATES).json()
    assert [row['certificate_id'] for row in listed] == [certificate.certificate_number]
    notes = f.Notification.objects.filter(recipient=student, notification_type='certificate_earned')
    assert [n.title for n in notes] == [f'Certificate earned: "{course.course.title}"']


def test_a_grade_below_the_pass_mark_earns_nothing_until_a_retake_lifts_it(
        auth_client, instructor, student, course):
    f.enroll(student, course.course)
    client = auth_client(student)
    complete_reading_and_video(client, course)
    take_quiz(client, course, [])                  # 0 %
    hand_in(client, course)
    grade(auth_client(instructor), course, student, 50)     # (0 * 40 + 50 * 60) / 100 = 30
    assert certificates_of(student).count() == 0

    take_quiz(client, course, [0, 1])              # 100 % -> (100 * 40 + 50 * 60) / 100 = 70

    (certificate,) = certificates_of(student)
    assert certificate.final_grade == Decimal('70.00')


def test_the_pass_mark_is_a_setting(auth_client, instructor, student, course, settings):
    settings.COURSE_PASSING_GRADE = 90
    f.enroll(student, course.course)
    client = auth_client(student)
    finish_without_a_grade_yet(client, course)

    grade(auth_client(instructor), course, student, 50)     # 70 is a pass, but not at 90

    assert certificates_of(student).count() == 0


def test_a_course_with_nothing_graded_certifies_on_completion(auth_client, instructor, student):
    bundle = f.build_course(instructor, status='published',
                            quiz_weight=Decimal('0'), assignment_weight=Decimal('0'))
    f.enroll(student, bundle.course)
    client = auth_client(student)

    finish_without_a_grade_yet(client, bundle, quiz_correct=())

    (certificate,) = certificates_of(student)
    assert certificate.final_grade is None


def test_an_unfinished_course_earns_nothing(auth_client, instructor, student, course):
    f.enroll(student, course.course)
    client = auth_client(student)
    complete_reading_and_video(client, course)
    take_quiz(client, course, [0, 1])

    assert certificates_of(student).count() == 0


# --------------------------------------------------------------------------- #
# once issued
# --------------------------------------------------------------------------- #
def test_nothing_issues_it_twice_or_changes_its_number(auth_client, instructor, student, course):
    f.enroll(student, course.course)
    client = auth_client(student)
    finish_without_a_grade_yet(client, course)
    grade(auth_client(instructor), course, student, 90)
    first = certificates_of(student).get()

    grade(auth_client(instructor), course, student, 100)    # graded again
    take_quiz(client, course, [0, 1])                       # retaken
    client.post(f'/api/v1/learning/courses/{course.course.uuid}/lectures/{course.video.uuid}/complete/')

    again = certificates_of(student).get()
    assert again.pk == first.pk
    assert (again.certificate_number, again.verification_code) == (
        first.certificate_number, first.verification_code)
    assert f.Notification.objects.filter(recipient=student,
                                         notification_type='certificate_earned').count() == 1


def test_numbers_and_codes_are_not_derivable(instructor, student, other_student):
    course = f.make_course(instructor, status='published')
    first = f.Certificate.objects.create(
        enrollment=f.enroll(student, course, status='completed'), student=student, course=course,
        completion_date=timezone.now())
    second = f.Certificate.objects.create(
        enrollment=f.enroll(other_student, course, status='completed'), student=other_student,
        course=course, completion_date=timezone.now())

    for certificate in (first, second):
        assert NUMBER.match(certificate.certificate_number)
        assert re.fullmatch(r'[0-9a-f]{20}', certificate.verification_code)
    assert first.certificate_number != second.certificate_number
    assert first.verification_code != second.verification_code


# --------------------------------------------------------------------------- #
# the backfill
# --------------------------------------------------------------------------- #
@pytest.fixture
def legacy(instructor, student, other_student):
    """Two completed enrolments that predate automatic issuing: one earned a certificate (nothing
    in the course is graded), one is waiting for a grade."""
    ungraded = f.build_course(instructor, status='published',
                              quiz_weight=Decimal('0'), assignment_weight=Decimal('0'))
    graded = f.build_course(instructor, status='published')
    earned = f.enroll(student, ungraded.course, status='completed')
    waiting = f.enroll(other_student, graded.course, status='completed')
    f.make_submission(graded.assignment, other_student, enrollment=waiting)   # not graded yet
    f.Enrollment.objects.filter(pk=earned.pk).update(completed_date=timezone.now() - timedelta(days=9))
    return earned, waiting


def run(*args):
    out = StringIO()
    call_command('issue_certificates', *args, stdout=out)
    return out.getvalue()


def test_the_backfill_reports_in_a_dry_run_and_changes_nothing(legacy):
    output = run('--dry-run')

    assert 'would issue' in output
    assert '1 certificates would be issued; 0 below the pass mark, 1 waiting for a grade.' in output
    assert f.Certificate.objects.count() == 0


def test_the_backfill_issues_silently_and_only_once(legacy, student):
    earned, _waiting = legacy

    run()
    run()

    (certificate,) = f.Certificate.objects.all()
    assert certificate.enrollment_id == earned.pk
    assert certificate.issue_date.date() == f.reload(earned).completed_date.date()   # dated when it was earned
    assert f.reload(earned).certificate_issued is True
    assert not f.Notification.objects.filter(notification_type='certificate_earned').exists()


def test_the_backfill_can_notify(legacy, student):
    run('--notify')

    assert f.Notification.objects.filter(recipient=student, notification_type='certificate_earned').count() == 1


# --------------------------------------------------------------------------- #
# verifying one
# --------------------------------------------------------------------------- #
def verify_url(code):
    return f'/api/v1/certificates/verify/{code}/'


def test_the_link_of_a_certificate_opens_the_verification_page_of_the_app(auth_client, instructor, student):
    enrollment = f.enroll(student, f.make_course(instructor, status='published'), status='completed')
    certificate = f.make_certificate(enrollment)

    row = auth_client(student).get(CERTIFICATES).json()[0]

    assert row['verification_url'] == f'http://localhost:3000/verify/{certificate.verification_code}'


def test_anybody_with_the_code_can_check_a_certificate(api, instructor, student):
    course = f.make_course(instructor, status='published', title='Statistics', estimated_hours=Decimal('12.5'))
    certificate = f.make_certificate(f.enroll(student, course, status='completed'), grade=Decimal('91.25'))

    r = api.get(verify_url(certificate.verification_code))

    assert r.status_code == 200
    assert r.json() == {
        'certificate_number': certificate.certificate_number,
        'verification_code': certificate.verification_code,
        'student_name': 'Student Tester',
        'course_title': 'Statistics',
        'instructor': 'Instructor Tester',
        'issue_date': certificate.issue_date.isoformat(),
        'grade': 91.25,
        'course_hours': 12.5,
    }


def test_a_certificate_of_an_ungraded_course_has_no_grade(api, instructor, student):
    certificate = f.make_certificate(
        f.enroll(student, f.make_course(instructor, status='published'), status='completed'), grade=None)

    body = api.get(verify_url(certificate.verification_code)).json()

    assert body['grade'] is None and body['course_hours'] is None


def test_an_unknown_code_is_a_404(api):
    r = api.get(verify_url('0123456789abcdef0123'))

    assert r.status_code == 404
    assert r.json() == {'error': 'No certificate has this verification code.'}
