"""Assessment slice: assignment submission, download permissions, instructor
review and grading."""
import uuid
from datetime import timedelta

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

INSTRUCTOR_ASSIGNMENTS = '/api/v1/assessments/instructor/assignments/'


def submit_url(assignment):
    return f'/api/v1/assessments/assignments/{assignment.uuid}/submit/'


def download_url(submission):
    return f'/api/v1/assessments/submissions/{submission.uuid}/download/'


def grade_url(submission):
    return f'/api/v1/assessments/instructor/submissions/{submission.uuid}/grade/'


def submissions_url(assignment):
    return f'{INSTRUCTOR_ASSIGNMENTS}{assignment.uuid}/submissions/'


@pytest.fixture
def setup(instructor, student):
    """Published course with one assignment, ``student`` enrolled."""
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)
    bundle.enrollment = enrollment
    return bundle


def submit_file(client, assignment, file=None, text=''):
    file = file or f.pdf_file('essay.pdf')
    return client.post(submit_url(assignment), {'submission_text': text, 'submission_file': file},
                       format='multipart')


# --------------------------------------------------------------------------- #
# submit
# --------------------------------------------------------------------------- #
def test_student_submits_a_file(auth_client, student, setup):
    """Submitting a file answers 200 (not 201), stores the upload and auto-completes the lecture."""
    r = submit_file(auth_client(student), setup.assignment)

    assert r.status_code == 200  # note: not 201
    body = r.json()
    assert body['success'] is True
    assert set(body['submission']) == {'id', 'submitted_at', 'is_late', 'original_filename',
                                       'has_file', 'has_text'}
    assert body['submission']['original_filename'] == 'essay.pdf'
    assert body['submission']['has_file'] is True
    assert body['submission']['has_text'] is False
    assert body['submission']['is_late'] is False

    submission = f.AssignmentSubmission.objects.get(assignment=setup.assignment, student=student)
    assert str(submission.uuid) == body['submission']['id']
    name = submission.submission_file.name
    assert name.startswith('assignment_uploads/') and name.endswith('.pdf')
    assert submission.submission_file.storage.exists(name)  # lands in the temp MEDIA_ROOT
    assert submission.grade is None

    # the assignment lecture is auto-completed
    progress = f.LectureProgress.objects.get(enrollment=setup.enrollment,
                                             lecture=setup.assignment_lecture)
    assert progress.is_completed is True
    setup.enrollment.refresh_from_db()
    assert setup.enrollment.progress_percentage == 25


def test_student_submits_text_only(auth_client, student, setup):
    """A text-only submission is accepted and has no file."""
    r = auth_client(student).post(submit_url(setup.assignment),
                                  {'submission_text': 'My written answer'}, format='multipart')

    assert r.status_code == 200
    assert r.json()['submission']['has_text'] is True
    assert r.json()['submission']['has_file'] is False
    submission = f.AssignmentSubmission.objects.get(assignment=setup.assignment, student=student)
    assert submission.submission_text == 'My written answer'
    assert not submission.submission_file


def test_submission_needs_text_or_a_file(auth_client, student, setup):
    """An empty / blank submission is a 400."""
    r = auth_client(student).post(submit_url(setup.assignment), {'submission_text': '   '},
                                  format='multipart')

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.AssignmentSubmission.objects.count() == 0


def test_duplicate_submission_is_rejected(auth_client, student, setup):
    """A second submission by the same student is a 400."""
    client = auth_client(student)
    assert submit_file(client, setup.assignment).status_code == 200

    r = submit_file(client, setup.assignment)

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.AssignmentSubmission.objects.filter(assignment=setup.assignment, student=student).count() == 1


def test_submission_requires_enrolment_student_role_and_known_assignment(
        api, auth_client, instructor, other_student, setup):
    """Anonymous 401, instructor 403, not enrolled 403, unknown assignment 404."""
    assert submit_file(api, setup.assignment).status_code == 401
    assert submit_file(auth_client(instructor), setup.assignment).status_code == 403
    r = submit_file(auth_client(other_student), setup.assignment)  # not enrolled
    assert r.status_code == 403
    assert 'error' in r.json()
    r = auth_client(other_student).post(f'/api/v1/assessments/assignments/{uuid.uuid4()}/submit/',
                                        {'submission_text': 'x'}, format='multipart')
    assert r.status_code == 404
    assert f.AssignmentSubmission.objects.count() == 0


def test_late_submission_blocked_when_not_allowed(auth_client, student, setup):
    """Past the deadline and ``allow_late_submission`` false -> 400."""
    late = f.make_assignment_lecture(setup.section, title='Strict', allow_late_submission=False,
                                     due_date=timezone.now() - timedelta(days=1)).assignment
    f.LectureProgress.objects.get_or_create(enrollment=setup.enrollment, lecture=late.lecture)

    r = submit_file(auth_client(student), late)

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.AssignmentSubmission.objects.filter(assignment=late).count() == 0


def test_late_submission_is_flagged_when_allowed(auth_client, student, setup):
    """Past the deadline with late submissions allowed -> 200 and ``is_late``."""
    late = f.make_assignment_lecture(setup.section, title='Lenient', allow_late_submission=True,
                                     due_date=timezone.now() - timedelta(days=1)).assignment

    r = submit_file(auth_client(student), late)

    assert r.status_code == 200
    assert r.json()['submission']['is_late'] is True
    assert f.AssignmentSubmission.objects.get(assignment=late, student=student).is_late is True


def test_submission_before_the_deadline_is_not_late(auth_client, student, setup):
    """A submission before the due date is not flagged late."""
    open_ = f.make_assignment_lecture(setup.section, title='Open', allow_late_submission=False,
                                      due_date=timezone.now() + timedelta(days=3)).assignment

    r = submit_file(auth_client(student), open_)

    assert r.status_code == 200
    assert r.json()['submission']['is_late'] is False


def test_disallowed_or_unsafe_file_names_are_a_400(auth_client, student, setup):
    """Current behaviour: the model's validation (extension whitelist and a strict
    ``[A-Za-z0-9._-]`` file-name rule) surfaces as a 400 ``Failed to create``."""
    client = auth_client(student)

    r = submit_file(client, setup.assignment, f.named_file('payload.exe', b'MZ'))
    assert r.status_code == 400
    assert 'error' in r.json()

    r = submit_file(client, setup.assignment, f.pdf_file('my essay (final).pdf'))
    assert r.status_code == 400

    assert f.AssignmentSubmission.objects.count() == 0


@pytest.mark.pinned_bug
def test_inactive_assignment_still_accepts_submissions_but_is_hidden_from_listings(
        auth_client, instructor, student, setup):
    """Current behaviour: ``Assignment.is_active`` is only honoured by the instructor
    assignment list and the grade calculation, not by the submit endpoint."""
    f.Assignment.objects.filter(pk=setup.assignment.pk).update(is_active=False)

    r = submit_file(auth_client(student), setup.assignment)

    assert r.status_code == 200
    assert auth_client(instructor).get(INSTRUCTOR_ASSIGNMENTS).json() == []


# --------------------------------------------------------------------------- #
# download
# --------------------------------------------------------------------------- #
def test_download_permissions(api, auth_client, student, other_student, instructor,
                              other_instructor, admin, setup):
    """Owner and course instructor get the file; everybody else (incl. admins) 404; anonymous 401."""
    assert submit_file(auth_client(student), setup.assignment,
                       f.txt_file('answer.txt', 'file body')).status_code == 200
    submission = f.AssignmentSubmission.objects.get(assignment=setup.assignment, student=student)
    url = download_url(submission)

    r = auth_client(student).get(url)  # owner
    assert r.status_code == 200
    assert r.content == b'file body'
    assert 'attachment' in r['Content-Disposition']
    assert 'answer.txt' in r['Content-Disposition']
    assert r['Content-Type'].startswith('text/plain')

    assert auth_client(instructor).get(url).status_code == 200  # instructor of the course
    assert auth_client(other_student).get(url).status_code == 404
    assert auth_client(other_instructor).get(url).status_code == 404
    assert auth_client(admin).get(url).status_code == 404  # current behaviour: admins are refused
    assert api.get(url).status_code == 401


def test_download_of_text_only_or_unknown_submission_is_404(auth_client, student, setup):
    """No file attached or unknown submission -> 404."""
    client = auth_client(student)
    assert client.post(submit_url(setup.assignment), {'submission_text': 'just text'},
                       format='multipart').status_code == 200
    submission = f.AssignmentSubmission.objects.get(assignment=setup.assignment, student=student)

    assert client.get(download_url(submission)).status_code == 404
    assert client.get(f'/api/v1/assessments/submissions/{uuid.uuid4()}/download/').status_code == 404


# --------------------------------------------------------------------------- #
# instructor: listing
# --------------------------------------------------------------------------- #
def test_instructor_lists_assignments_with_submission_counts(
        auth_client, instructor, other_instructor, student, other_student, setup):
    """The instructor list only shows own assignments, with total / graded / pending counts."""
    f.enroll(other_student, setup.course)
    graded = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)
    f.AssignmentSubmission.objects.filter(pk=graded.pk).update(grade=80)
    f.make_submission(setup.assignment, other_student)
    foreign = f.build_course(other_instructor, status='published')

    r = auth_client(instructor).get(INSTRUCTOR_ASSIGNMENTS)

    assert r.status_code == 200
    rows = r.json()
    assert [row['id'] for row in rows] == [str(setup.assignment.uuid)]
    row = rows[0]
    assert set(row) == {'id', 'title', 'description', 'instructions', 'max_points',
                        'passing_score', 'due_date', 'course_title', 'course_id',
                        'lecture_title', 'total_submissions', 'graded_submissions',
                        'pending_submissions', 'created_at'}
    assert row['total_submissions'] == 2
    assert row['graded_submissions'] == 1
    assert row['pending_submissions'] == 1
    assert row['course_id'] == str(setup.course.uuid)
    assert str(foreign.assignment.uuid) not in [x['id'] for x in rows]


def test_instructor_lists_submissions_of_an_assignment(auth_client, instructor, student, setup):
    """The submission listing has a fixed key set and shows the ungraded submission."""
    f.make_submission(setup.assignment, student, enrollment=setup.enrollment, text='my text')

    r = auth_client(instructor).get(submissions_url(setup.assignment))

    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert set(rows[0]) == {'id', 'student_id', 'student_name', 'student_email',
                            'submission_text', 'has_file', 'original_filename', 'submitted_at',
                            'is_late', 'grade', 'feedback', 'graded_by', 'graded_at'}
    assert rows[0]['student_email'] == student.email
    assert rows[0]['grade'] is None
    assert rows[0]['submission_text'] == 'my text'


def test_submission_listing_of_a_foreign_assignment_is_a_404(auth_client, other_instructor, setup):
    """Another instructor's assignment does not exist for you (it used to be a 500)."""
    r = auth_client(other_instructor).get(submissions_url(setup.assignment))

    assert r.status_code == 404


# --------------------------------------------------------------------------- #
# instructor: grading
# --------------------------------------------------------------------------- #
def test_instructor_grades_a_submission_and_student_is_notified(
        auth_client, instructor, student, setup):
    """Grading stores grade / feedback / grader and creates an ``assignment_graded`` notification."""
    submission = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)

    r = auth_client(instructor).post(grade_url(submission),
                                     {'grade': 85, 'feedback': '  Nicely done  '}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert 'message' in body
    assert set(body['submission']) == {'id', 'grade', 'feedback', 'graded_by', 'graded_at'}
    assert body['submission']['grade'] == pytest.approx(85.0)
    assert body['submission']['feedback'] == 'Nicely done'

    submission.refresh_from_db()
    assert submission.grade == 85
    assert submission.feedback == 'Nicely done'
    assert submission.graded_by_id == instructor.id
    assert submission.graded_at is not None

    notes = f.Notification.objects.filter(recipient=student, notification_type='assignment_graded')
    assert notes.count() == 1
    assert notes.get().action_url == f'/courses/{setup.course.uuid}/learn'
    assert notes.get().is_read is False

    # the student sees the grade in the player payload
    payload = auth_client(student).get(f'/api/v1/learning/courses/{setup.course.uuid}/learn/').json()
    lecture = [lec for lec in payload['sections'][0]['lectures']
               if lec['content_type'] == 'assignment'][0]
    assert lecture['submission']['graded'] is True
    assert lecture['submission']['grade'] == pytest.approx(85.0)


def test_grade_accepts_numeric_strings_and_the_boundaries(auth_client, instructor, student, setup):
    """Grades may be numeric strings; 0 and max_points are valid."""
    submission = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)
    client = auth_client(instructor)

    for value in ('90', 0, 100):
        r = client.post(grade_url(submission), {'grade': value}, format='json')
        assert r.status_code == 200, value
    submission.refresh_from_db()
    assert submission.grade == 100


def test_grade_validation(auth_client, instructor, student, setup):
    """Missing, non-numeric, negative or above-max grades are 400s and change nothing."""
    submission = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)
    client = auth_client(instructor)
    max_points = setup.assignment.max_points

    for payload in ({}, {'grade': None}, {'grade': 'abc'}, {'grade': -1}, {'grade': max_points + 1}):
        r = client.post(grade_url(submission), payload, format='json')
        assert r.status_code == 400, payload
        assert 'error' in r.json()

    submission.refresh_from_db()
    assert submission.grade is None
    assert f.Notification.objects.filter(recipient=student).count() == 0


def test_grading_is_for_instructors_only(api, auth_client, student, setup):
    """Anonymous 401 and students 403; nothing is graded."""
    submission = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)

    assert api.post(grade_url(submission), {'grade': 50}, format='json').status_code == 401
    assert auth_client(student).post(grade_url(submission), {'grade': 50}, format='json'
                                     ).status_code == 403

    submission.refresh_from_db()
    assert submission.grade is None


def test_grading_a_foreign_submission_is_a_404(auth_client, student, other_instructor, setup):
    """Another instructor's submission does not exist for you; it stays ungraded."""
    submission = f.make_submission(setup.assignment, student, enrollment=setup.enrollment)

    r = auth_client(other_instructor).post(grade_url(submission), {'grade': 50}, format='json')

    assert r.status_code == 404
    submission.refresh_from_db()
    assert submission.grade is None
