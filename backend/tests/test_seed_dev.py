"""The seed_dev command: its guard rails, the generated assets and the world it builds."""
import io
from collections import Counter

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from PIL import Image

import factories as f
from apps.seeding import assets
from apps.seeding.data.courses import BY_SLUG, COURSES
from apps.seeding.data.people import PEOPLE
from apps.seeding.data.stories import STORIES

PASSWORD = 'seed-test-password'


def seed(**options):
    out = io.StringIO()
    options.setdefault('force', True)   # the test settings run with DEBUG=False
    call_command('seed_dev', stdout=out, **options)
    return out.getvalue()


@pytest.fixture(scope='module')
def world(django_db_setup, django_db_blocker):
    """The whole seed, built once for the module (it takes a few seconds)."""
    with django_db_blocker.unblock():
        output = seed(password=PASSWORD)
        yield output
        call_command('flush', interactive=False, verbosity=0)


# --------------------------------------------------------------------------- #
# the command
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_it_refuses_to_run_without_debug_unless_forced():
    with pytest.raises(CommandError, match='DEBUG'):
        call_command('seed_dev', stdout=io.StringIO())
    assert f.User.objects.count() == 0


@pytest.mark.django_db
def test_a_generated_password_is_printed_once_and_works_for_every_user():
    output = seed()

    password = output.split('Password of the seeded users: ')[1].split()[0]
    users = list(f.User.objects.all())
    assert len(users) == len(PEOPLE)
    assert all(user.check_password(password) for user in users)


@pytest.mark.django_db
def test_the_password_can_come_from_the_settings(settings):
    settings.SEED_PASSWORD = 'from-the-environment'

    output = seed()

    assert 'from-the-environment' not in output
    assert all(user.check_password('from-the-environment') for user in f.User.objects.all())


@pytest.mark.django_db
def test_running_it_again_creates_nothing_and_keeps_passwords():
    seed(password='first-password')
    counts = {model.__name__: model.objects.count() for model in
              (f.User, f.Course, f.Enrollment, f.QuizAttempt, f.AssignmentSubmission, f.Notification)}
    hashes = dict(f.User.objects.values_list('email', 'password'))

    seed(password='second-password')

    assert {model.__name__: model.objects.count() for model in
            (f.User, f.Course, f.Enrollment, f.QuizAttempt, f.AssignmentSubmission, f.Notification)} == counts
    assert dict(f.User.objects.values_list('email', 'password')) == hashes


# --------------------------------------------------------------------------- #
# generated files
# --------------------------------------------------------------------------- #
def test_a_thumbnail_is_a_real_image_in_the_category_colours():
    png = assets.thumbnail('Statistics for Data Science', 'data-science')

    image = Image.open(io.BytesIO(png))
    image.load()
    assert image.format == 'PNG' and image.size == assets.THUMBNAIL_SIZE
    assert image.getpixel((5, 535)) != image.getpixel((5, 5))   # a gradient, not a flat colour


def test_a_pdf_is_well_formed_and_carries_the_text():
    data = assets.pdf('Week 2 summary', 'First paragraph (with parentheses).\n\nSecond one.')

    assert data.startswith(b'%PDF-1.4') and data.rstrip().endswith(b'%%EOF')
    assert b'Week 2 summary' in data and b'\\(with parentheses\\)' in data


# --------------------------------------------------------------------------- #
# the data files themselves (no database)
# --------------------------------------------------------------------------- #
def test_the_cast_has_unique_addresses_and_every_role():
    emails = [person.email for person in PEOPLE]

    assert len(emails) == len(set(emails))
    assert all(email.endswith('@example.com') for email in emails)
    assert Counter(person.role for person in PEOPLE) == {'admin': 2, 'instructor': 6, 'student': 24}


def test_course_slugs_and_lecture_titles_are_unique():
    assert len({course.slug for course in COURSES}) == len(COURSES)
    for course in COURSES:
        titles = [item.title for section in course.sections for item in section.items]
        assert len(titles) == len(set(titles)), course.slug


def test_every_story_points_at_a_known_person_and_course():
    emails = {person.email for person in PEOPLE}
    known = set(BY_SLUG) | {'introduction-to-python', 'applied-machine-learning'}
    for story in STORIES:
        assert story.email in emails
        for enrolment in story.enrol:
            assert enrolment.course in known
        assert set(story.bookmarks) <= known


# --------------------------------------------------------------------------- #
# the world
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_the_cast_exists_with_its_states(world):
    users = f.User.objects
    assert users.count() == len(PEOPLE)
    assert users.filter(user_type='admin').count() == 2
    assert users.filter(is_superuser=True).count() == 1
    assert users.filter(is_active=False).count() == 1
    assert users.filter(email_verified=False).count() == 1
    assert users.filter(last_login__isnull=True).count() == 1
    assert users.get(email='noah.bennett@example.com').courses_created.count() == 0
    assert all(user.check_password(PASSWORD) for user in users.all())


@pytest.mark.django_db
def test_every_moderation_state_has_a_course(world):
    statuses = Counter(f.Course.objects.values_list('status', flat=True))

    assert set(statuses) == {'draft', 'pending_review', 'published', 'rejected', 'unpublished'}
    assert statuses['published'] >= 9 and statuses['pending_review'] == 2
    rejected = f.Course.objects.get(status='rejected')
    assert rejected.rejection_reason and rejected.rejected_by.email == 'demo.admin@example.com'
    assert f.Course.objects.filter(is_featured=True).count() == 1


@pytest.mark.django_db
def test_courses_are_consistent(world):
    for course in f.Course.objects.all():
        assert course.thumbnail, course.slug
        quizzes = sum(q.weight for q in course.quizzes.all())
        work = sum(a.weight for a in course.assignments.all())
        if course.status in ('published', 'rejected') or course.slug == 'cloud-computing-fundamentals':
            assert quizzes + work == 100, course.slug
        if course.status == 'published':
            assert course.published_date is not None
            assert course.duration_hours >= 1, course.slug
        for section in course.sections.all():
            orders = list(section.lectures.values_list('order', flat=True))
            assert orders == sorted(set(orders)), course.slug


@pytest.mark.django_db
def test_the_review_screen_can_show_a_missing_weight(world):
    course = f.Course.objects.get(slug='full-stack-django-with-postgresql')

    total = sum(q.weight for q in course.quizzes.all()) + sum(a.weight for a in course.assignments.all())

    assert course.status == 'pending_review' and total == 90


@pytest.mark.django_db
def test_progress_matches_the_finished_lectures(world):
    for enrollment in f.Enrollment.objects.select_related('course'):
        total = f.Lecture.objects.filter(section__course=enrollment.course).count()
        done = f.LectureProgress.objects.filter(enrollment=enrollment, is_completed=True).count()
        assert float(enrollment.progress_percentage) == pytest.approx(round(done / total * 100, 2)), \
            f'{enrollment.student.email} / {enrollment.course.slug}'
        assert (enrollment.status == 'completed') == (done == total)


@pytest.mark.django_db
def test_enrolment_counters_were_kept_by_the_service(world):
    for course in f.Course.objects.all():
        assert course.total_enrolled == f.Enrollment.objects.filter(course=course).count(), course.slug


@pytest.mark.django_db
def test_certificates_belong_to_completed_enrolments(world):
    completed = f.Enrollment.objects.filter(status='completed')
    certificates = f.Certificate.objects.all()

    assert completed.count() == certificates.count() == 5
    assert set(certificates.values_list('enrollment_id', flat=True)) == set(
        completed.values_list('id', flat=True))
    assert all(c.final_grade is not None and c.certificate_number for c in certificates)
    assert f.Enrollment.objects.filter(certificate_issued=True).count() == 5


@pytest.mark.django_db
def test_quiz_outcomes_cover_pass_fail_and_exhausted_attempts(world):
    oliver = f.User.objects.get(email='oliver.smith@example.com')
    attempts = f.QuizAttempt.objects.filter(student=oliver, quiz__title='Check your understanding')
    assert attempts.count() == 3 and not attempts.filter(passed=True).exists()
    assert attempts.first().quiz.max_attempts == 3

    demo = f.User.objects.get(email='demo.student@example.com')
    first, second = f.QuizAttempt.objects.filter(
        student=demo, quiz__title='Check your understanding').order_by('attempt_number')
    assert not first.passed and second.passed and second.score == 100

    assert f.QuizAttempt.objects.filter(score=100).count() >= 3


@pytest.mark.django_db
def test_hand_ins_are_graded_waiting_or_late(world):
    submissions = f.AssignmentSubmission.objects
    waiting = submissions.filter(grade__isnull=True)

    assert waiting.count() == 4
    assert submissions.filter(grade__isnull=False).count() >= 10
    assert submissions.filter(grade__lt=60).count() == 2          # below the passing score
    assert all(s.feedback for s in submissions.filter(grade__isnull=False))
    assert submissions.exclude(submission_file='').count() == 3


@pytest.mark.django_db
def test_the_streak_student_has_activity_on_eight_consecutive_days(world):
    from apps.insights import student as insights

    amara = f.User.objects.get(email='amara.okoye@example.com')

    assert insights.learning_streak(amara) >= 7
    assert any(b['title'] == 'Week Warrior' and b['earned'] for b in insights.badges(amara))


@pytest.mark.django_db
def test_notifications_were_created_by_the_events_and_dated_back(world):
    demo = f.User.objects.get(email='demo.student@example.com')
    notes = f.Notification.objects.filter(recipient=demo)
    types = set(notes.values_list('notification_type', flat=True))

    assert {'enrollment', 'assignment_graded', 'certificate_earned', 'payment_success'} <= types
    ages = [(f.Notification.objects.latest('created_at').created_at - n.created_at).days for n in notes]
    assert max(ages) > 30        # the welcome message is from months ago, not from the seed run
