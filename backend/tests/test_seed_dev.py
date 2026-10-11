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
    counts = row_counts()
    hashes = dict(f.User.objects.values_list('email', 'password'))

    seed(password='second-password')

    assert row_counts() == counts
    assert dict(f.User.objects.values_list('email', 'password')) == hashes


MODELS = (f.User, f.Course, f.Lecture, f.Enrollment, f.LectureProgress, f.QuizAttempt,
          f.AssignmentSubmission, f.Certificate, f.CourseBookmark, f.Notification, f.DirectMessage,
          f.StudentPlusSubscription, f.StudentPlusPayment, f.InstructorEarning)


def row_counts():
    return {model.__name__: model.objects.count() for model in MODELS}


@pytest.mark.django_db
def test_reset_replaces_the_seeded_data_and_leaves_everybody_else_alone():
    seed(password='first-password')
    before = row_counts()
    stranger = f.make_student(email='someone.else@example.org')
    foreign_course = f.make_course(f.make_instructor(email='teacher.else@example.org'),
                                   status='published')
    f.Enrollment.objects.create(student=stranger, course=foreign_course)
    stranger_note = f.make_notification(stranger, title='Mine')

    output = seed(password='second-password', reset=True)

    assert 'Removed 32 users' in output
    after = row_counts()
    # the seeded rows are back; what is left over is exactly what the stranger brought
    assert after['User'] == before['User'] + 2
    assert after['Course'] == before['Course'] + 1
    assert after['Enrollment'] == before['Enrollment'] + 1
    assert after['Notification'] == before['Notification'] + 1
    for label in ('Lecture', 'QuizAttempt', 'AssignmentSubmission', 'Certificate', 'DirectMessage',
                  'InstructorEarning', 'StudentPlusSubscription'):
        assert after[label] == before[label], label
    assert f.User.objects.get(email='someone.else@example.org').check_password(f.DEFAULT_PASSWORD)
    assert f.Notification.objects.filter(pk=stranger_note.pk).exists()
    assert f.User.objects.get(email='demo.student@example.com').check_password('second-password')


def test_the_cast_can_be_listed_without_a_database(capsys):
    call_command('seed_dev', list_cast=True)

    lines = capsys.readouterr().out.strip().splitlines()
    assert len(lines) == len(PEOPLE) + 1
    assert any('demo.student@example.com' in line for line in lines)


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
    showcase = {'javascript-from-scratch', 'statistics-for-data-science', 'introduction-to-python'}
    for course in f.Course.objects.all():
        enrolled = f.Enrollment.objects.filter(course=course).count()
        if course.slug in showcase:     # a popularity counter, higher than the learners seeded
            assert course.total_enrolled > enrolled, course.slug
        else:
            assert course.total_enrolled == enrolled, course.slug


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


@pytest.mark.django_db
def test_conversations_have_read_and_unread_messages(world):
    demo = f.User.objects.get(email='demo.student@example.com')
    unread = f.DirectMessage.objects.filter(recipient=demo, is_read=False)

    assert unread.count() == 4
    assert len(set(unread.values_list('conversation_id', flat=True))) == 2
    sizes = Counter(f.DirectMessage.objects.values_list('conversation_id', flat=True))
    assert max(sizes.values()) >= 30 and len(sizes) == 12
    assert f.DirectMessage.objects.filter(is_read=True, read_at__isnull=False).exists()


@pytest.mark.django_db
def test_the_headline_students_bell_shows_nine_plus(world):
    demo = f.User.objects.get(email='demo.student@example.com')
    notes = f.Notification.objects.filter(recipient=demo)

    assert notes.filter(is_read=False).count() >= 10
    assert notes.filter(is_read=True).exists()
    assert {'announcement', 'assignment_due', 'quiz_available', 'course_update', 'system'} <= set(
        notes.values_list('notification_type', flat=True))


@pytest.mark.django_db
def test_the_instructor_screens_are_populated_except_for_the_empty_ones(world):
    from apps.insights import instructor as insights

    ravi = f.User.objects.get(email='ravi.shah@example.com')
    dashboard = insights.dashboard(ravi)
    assert dashboard['stats']['total_revenue'] > 0
    assert len([c for c in dashboard['top_courses'] if c['total_revenue'] > 0]) == 2
    assert any(point['revenue'] > 0 for point in dashboard['revenue_chart'])

    earnings = insights.earnings(ravi)
    assert earnings['summary']['total_earnings'] > 0 and earnings['summary']['pending_earnings'] > 0
    assert earnings['summary']['monthly_earnings'] > 0
    assert sum(1 for month in earnings['monthly_chart'] if month['earnings'] > 0) >= 2

    lena = insights.dashboard(f.User.objects.get(email='lena.fischer@example.com'))
    assert lena['stats']['total_revenue'] == 0 and lena['stats']['published_courses'] == 2
    noah = insights.dashboard(f.User.objects.get(email='noah.bennett@example.com'))
    assert noah['stats']['total_courses'] == 0 and noah['recent_enrollments'] == []


@pytest.mark.django_db
def test_earnings_exist_for_plus_courses_only(world):
    kinds = set(f.InstructorEarning.objects.values_list('course__course_type', flat=True))

    assert kinds == {'coursera_plus'}
    assert f.InstructorEarning.objects.filter(is_paid=True).exists()
    assert f.InstructorEarning.objects.filter(is_paid=False).exists()
    assert f.InstructorEarning.objects.values('month').distinct().count() >= 5


@pytest.mark.django_db
def test_plus_access_follows_the_subscription_stories(world):
    from apps.billing.selectors import has_plus_access

    def access(email):
        return has_plus_access(f.User.objects.get(email=email))

    assert access('demo.student@example.com') and access('amara.okoye@example.com')
    assert access('liam.chen@example.com')
    assert not access('sara.haddad@example.com')          # cancelled
    assert not access('mateo.alvarez@example.com')        # lapsed after a failed payment
    assert not access('ethan.walker@example.com')         # never subscribed

    sara = f.StudentPlusSubscription.objects.get(student__email='sara.haddad@example.com')
    assert sara.status == 'cancelled' and not sara.auto_renew and sara.end_date > sara.updated_at
    mateo = f.StudentPlusSubscription.objects.get(student__email='mateo.alvarez@example.com')
    assert mateo.status == 'active' and mateo.payments.filter(status='failed').count() == 1
    assert f.StudentPlusSubscription.objects.count() == 5


@pytest.mark.django_db
def test_deadlines_and_late_hand_ins(world):
    from django.utils import timezone

    late = f.AssignmentSubmission.objects.filter(is_late=True)
    assert set(late.values_list('student__email', flat=True)) == {
        'chloe.dubois@example.com', 'oliver.smith@example.com', 'hannah.weiss@example.com'}
    assert late.filter(grade__isnull=True).count() == 1          # Chloe's, still waiting

    now = timezone.now()
    assert f.Assignment.objects.filter(due_date__lt=now).exists()
    assert f.Assignment.objects.filter(due_date__gt=now).exists()
    assert f.Assignment.objects.filter(due_date__isnull=True).exists()
    assert f.Assignment.objects.filter(allow_late_submission=False).exists()


@pytest.mark.django_db
def test_a_course_taken_offline_keeps_its_learners(world):
    course = f.Course.objects.get(slug='html-and-css-crash-course')

    assert course.status == 'draft' and course.published_date is None
    assert f.Enrollment.objects.filter(course=course, status='active').count() == 2


@pytest.mark.django_db
def test_showcase_courses_show_their_popularity(world):
    assert f.Course.objects.get(slug='javascript-from-scratch').total_enrolled == 5310
    assert f.Course.objects.get(slug='introduction-to-python').total_enrolled == 2140
    smaller = f.Course.objects.get(slug='project-management-essentials')
    assert smaller.total_enrolled == f.Enrollment.objects.filter(course=smaller).count()


# --------------------------------------------------------------------------- #
# the screens: what each persona's pages receive from the API
# --------------------------------------------------------------------------- #
def api_get(auth_client, email, path):
    response = auth_client(f.User.objects.get(email=email)).get(path)
    assert response.status_code == 200, (email, path, response.status_code)
    return response.json()


@pytest.mark.django_db
def test_the_student_screens_are_populated(world, auth_client):
    demo = 'demo.student@example.com'

    stats = api_get(auth_client, demo, '/api/insights/student/stats/')
    assert (stats['courses_enrolled'], stats['courses_completed'], stats['certificates_earned']) == (5, 1, 1)
    assert stats['has_plus_subscription'] is True and stats['total_learning_hours'] > 0

    enrolled = api_get(auth_client, demo, '/api/learning/enrolled/')      # the completed course is not listed
    assert sorted(round(course['progress']) for course in enrolled) == [0, 25, 50, 75]

    catalogue = api_get(auth_client, demo, '/api/learning/courses/')
    assert len(catalogue) >= 9
    assert {course['course_type'] for course in catalogue} == {'free', 'coursera_plus'}
    assert any(course['is_bookmarked'] for course in catalogue)

    gradebook = api_get(auth_client, demo, '/api/assessments/student/gradebook/')
    assert len(gradebook['courses']) == 4
    achievements = api_get(auth_client, demo, '/api/insights/student/achievements/')
    assert achievements['total_points'] > 0 and any(a['earned'] for a in achievements['achievements'])
    assert len(api_get(auth_client, demo, '/api/certificates/')) == 1
    assert api_get(auth_client, demo, '/api/billing/subscription/')['can_access_plus_courses'] is True
    assert api_get(auth_client, demo, '/api/notifications/count/')['unread_count'] >= 10
    conversations = api_get(auth_client, demo, '/api/messaging/conversations/')['conversations']
    assert len(conversations) == 4 and sum(c['unread_count'] for c in conversations) == 4


@pytest.mark.django_db
def test_every_category_of_the_explore_filter_has_a_course(world, auth_client):
    for category in ('programming', 'web-development', 'data-science', 'design', 'marketing', 'business'):
        courses = api_get(auth_client, 'demo.student@example.com',
                          f'/api/learning/courses/?category={category}')
        assert courses, category
    assert api_get(auth_client, 'demo.student@example.com', '/api/learning/courses/?search=python')


@pytest.mark.django_db
def test_the_empty_states_really_are_empty(world, auth_client):
    mei = 'mei.lin@example.com'

    assert api_get(auth_client, mei, '/api/learning/enrolled/') == []
    assert api_get(auth_client, mei, '/api/certificates/') == []
    assert api_get(auth_client, mei, '/api/insights/student/stats/')['courses_enrolled'] == 0
    assert api_get(auth_client, mei, '/api/billing/subscription/')['has_subscription'] is False
    assert api_get(auth_client, 'ethan.walker@example.com', '/api/learning/enrolled/') == []
    assert api_get(auth_client, 'noah.bennett@example.com', '/api/courses/instructor/courses/') == []
    assert api_get(auth_client, 'noah.bennett@example.com', '/api/learning/instructor/students/') == []


@pytest.mark.django_db
def test_the_instructor_screens_are_populated(world, auth_client):
    james = 'james.okafor@example.com'

    courses = api_get(auth_client, james, '/api/courses/instructor/courses/')
    assert {course['status'] for course in courses} == {'published', 'pending_review', 'draft'}
    assert max(course['total_revenue'] for course in courses) > 0
    students = api_get(auth_client, james, '/api/learning/instructor/students/')
    assert any(student['courses_enrolled_count'] == 2 for student in students)

    assignments = api_get(auth_client, 'ravi.shah@example.com', '/api/assessments/instructor/assignments/')
    assert any(a['pending_submissions'] for a in assignments) and any(a['graded_submissions'] for a in assignments)


@pytest.mark.django_db
def test_the_admin_screens_are_populated(world, auth_client):
    admin = 'demo.admin@example.com'

    pending = api_get(auth_client, admin, '/api/courses/admin/pending/')
    assert len(pending) == 2
    assert sorted(course['total_weight'] for course in pending) == [90.0, 100.0]
    assert len(api_get(auth_client, admin, '/api/courses/admin/all/')) == 18
    users = api_get(auth_client, admin, '/api/insights/admin/users/')
    assert len(users) == len(PEOPLE) and {u['user_type'] for u in users} == {'admin', 'instructor', 'student'}
    assert any(not user['is_active'] for user in users) and any(not user['email_verified'] for user in users)
