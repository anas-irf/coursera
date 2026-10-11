"""Discovery -> enrolment slice: public catalogue, enrol, bookmark, my courses,
Plus preview."""
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

ALL = '/api/courses/all/'
ENROLLED = '/api/courses/enrolled/'
PLUS_PREVIEW = '/api/courses/plus-preview/'

CATALOG_KEYS = {'id', 'title', 'instructor', 'instructor_id', 'thumbnail', 'rating',
                'students', 'duration', 'level', 'category', 'course_type', 'modules',
                'description', 'is_enrolled', 'is_bookmarked', 'can_enroll',
                'enrollment_message', 'progress'}


def enroll_url(course):
    return f'/api/courses/{course.uuid}/enroll/'


def ids(response):
    return [row['id'] for row in response.json()]


# --------------------------------------------------------------------------- #
# catalogue
# --------------------------------------------------------------------------- #
def test_catalogue_is_public_and_lists_only_published_courses(api, auth_client, instructor):
    """The catalogue needs no login and only lists published courses."""
    live = f.make_course(instructor, status='published', title='Live')
    for status in ('draft', 'pending_review', 'unpublished', 'rejected'):
        f.make_course(instructor, status=status, title=f'Hidden {status}')

    r = api.get(ALL)

    assert r.status_code == 200
    assert ids(r) == [str(live.uuid)]
    row = r.json()[0]
    assert set(row) == CATALOG_KEYS
    assert row['is_enrolled'] is False and row['is_bookmarked'] is False
    assert row['can_enroll'] is True
    assert row['progress'] == 0
    assert row['thumbnail']

    # any authenticated role may browse the catalogue
    for user in (instructor, f.make_admin()):
        assert ids(auth_client(user).get(ALL)) == [str(live.uuid)]


def test_catalogue_filters_and_sorting(api, instructor):
    """level / type / category filters and rating / popular / newest sorting."""
    dev = f.make_category('Development', 'development')
    cook = f.make_category('Cooking', 'cooking')
    basics = f.make_course(instructor, status='published', title='Python Basics', level='beginner',
                           course_type='free', category=dev, average_rating=Decimal('3.00'),
                           total_enrolled=50)
    adv = f.make_course(instructor, status='published', title='Advanced Django', level='advanced',
                        course_type='coursera_plus', category=dev, average_rating=Decimal('4.50'),
                        total_enrolled=10)
    pasta = f.make_course(instructor, status='published', title='Pasta Making', level='intermediate',
                          course_type='free', category=cook, average_rating=Decimal('4.90'),
                          total_enrolled=99)

    assert set(ids(api.get(ALL, {'level': 'advanced'}))) == {str(adv.uuid)}
    assert set(ids(api.get(ALL, {'type': 'free'}))) == {str(basics.uuid), str(pasta.uuid)}
    assert set(ids(api.get(ALL, {'type': 'coursera_plus'}))) == {str(adv.uuid)}
    assert set(ids(api.get(ALL, {'category': 'cooking'}))) == {str(pasta.uuid)}
    assert set(ids(api.get(ALL, {'level': 'advanced', 'type': 'free'}))) == set()

    assert ids(api.get(ALL, {'sort': 'rating'})) == [str(pasta.uuid), str(adv.uuid), str(basics.uuid)]
    assert ids(api.get(ALL, {'sort': 'popular'})) == [str(pasta.uuid), str(basics.uuid), str(adv.uuid)]
    assert ids(api.get(ALL, {'sort': 'newest'})) == [str(pasta.uuid), str(adv.uuid), str(basics.uuid)]
    # default sort is "popular"
    assert ids(api.get(ALL)) == ids(api.get(ALL, {'sort': 'popular'}))


@pytest.mark.pinned_bug
def test_catalogue_reports_module_count_and_video_hours(api, instructor):
    """``modules`` counts sections; ``duration`` is the video seconds as whole hours."""
    course = f.make_course(instructor, status='published')
    first = f.make_section(course)
    second = f.make_section(course)
    f.make_video(first, duration=3 * 3600)
    f.make_video(second, duration=2 * 3600 + 1800)
    f.make_reading(second)

    (row,) = api.get(ALL).json()

    assert row['modules'] == 2
    assert row['duration'] == '5 hours'


def test_catalogue_search_filters_by_title(api, instructor):
    """``search`` matches title/description/instructor name (it used to crash with a 500
    because the sanitizer ran an invalid regular expression; fixed in refactor step S2)."""
    f.make_course(instructor, status='published', title='Searchable django course')
    f.make_course(instructor, status='published', title='Cooking basics')

    hit = api.get(ALL, {'search': 'django'})
    assert hit.status_code == 200
    assert [row['title'] for row in hit.json()] == ['Searchable django course']

    assert api.get(ALL, {'search': 'no-such-course'}).json() == []
    # words the sanitizer strips must not break the request
    assert api.get(ALL, {'search': 'select'}).status_code == 200
    assert api.get(ALL, {'search': '/* x */ --'}).status_code == 200
    assert api.get(ALL, {'search': ''}).status_code == 200
    assert api.get(ALL).status_code == 200


def test_catalogue_enrolment_flags_for_a_student(auth_client, instructor, student):
    """is_enrolled / is_bookmarked / can_enroll reflect the student state."""
    free = f.make_course(instructor, status='published', title='Free one', course_type='free')
    plus = f.make_course(instructor, status='published', title='Plus one', course_type='coursera_plus')
    client = auth_client(student)

    rows = {row['id']: row for row in client.get(ALL).json()}
    assert rows[str(free.uuid)]['can_enroll'] is True
    assert not rows[str(free.uuid)]['enrollment_message']
    assert rows[str(plus.uuid)]['can_enroll'] is False
    assert rows[str(plus.uuid)]['enrollment_message']  # explains that Plus is needed

    f.enroll(student, free)
    assert client.post(f'/api/courses/{free.uuid}/bookmark/').status_code == 200
    rows = {row['id']: row for row in client.get(ALL).json()}
    assert rows[str(free.uuid)]['is_enrolled'] is True
    assert rows[str(free.uuid)]['is_bookmarked'] is True
    assert rows[str(free.uuid)]['can_enroll'] is False
    assert rows[str(free.uuid)]['enrollment_message']  # "already enrolled"
    assert rows[str(plus.uuid)]['is_enrolled'] is False

    f.give_plus(student)
    rows = {row['id']: row for row in client.get(ALL).json()}
    assert rows[str(plus.uuid)]['can_enroll'] is True


# --------------------------------------------------------------------------- #
# enrol
# --------------------------------------------------------------------------- #
def test_enroll_in_free_course(auth_client, instructor, student):
    """Enrolling answers 201 and creates enrolment, progress rows, counter and both notifications."""
    bundle = f.build_course(instructor, status='published', course_type='free')
    course = bundle.course

    r = auth_client(student).post(enroll_url(course))

    assert r.status_code == 201
    body = r.json()
    assert set(body) == {'message', 'enrollment_id'}

    enrollment = f.Enrollment.objects.get(student=student, course=course)
    assert str(enrollment.uuid) == body['enrollment_id']
    assert enrollment.status == 'active'
    assert enrollment.progress_percentage == 0
    # one progress row per lecture is created immediately
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == len(bundle.lectures)
    course.refresh_from_db()
    assert course.total_enrolled == 1

    # notifications for the student and for the instructor
    mine = f.Notification.objects.get(recipient=student, notification_type='enrollment')
    assert mine.action_url == f'/courses/{course.uuid}/learn'
    theirs = f.Notification.objects.get(recipient=instructor, notification_type='enrollment')
    assert theirs.action_url == '/instructor/courses'


def test_enroll_twice_is_a_400_and_counts_once(auth_client, instructor, student):
    """A duplicate enrolment is a 400 and is not counted twice."""
    course = f.build_course(instructor, status='published').course
    client = auth_client(student)
    assert client.post(enroll_url(course)).status_code == 201

    r = client.post(enroll_url(course))

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.Enrollment.objects.filter(student=student, course=course).count() == 1
    course.refresh_from_db()
    assert course.total_enrolled == 1


def test_plus_course_without_subscription_is_402(auth_client, instructor, student):
    """Plus course without subscription -> 402 with requires_subscription."""
    course = f.build_course(instructor, status='published', course_type='coursera_plus').course

    r = auth_client(student).post(enroll_url(course))

    assert r.status_code == 402
    body = r.json()
    assert body['requires_subscription'] is True
    assert body['course_type'] == 'coursera_plus'
    assert {'error', 'checkout_url', 'course_title', 'message'} <= set(body)
    assert not f.Enrollment.objects.filter(student=student, course=course).exists()
    course.refresh_from_db()
    assert course.total_enrolled == 0


def test_plus_course_with_lapsed_subscription_is_402(auth_client, instructor, student):
    """Cancelled or expired subscriptions do not unlock Plus courses."""
    course = f.build_course(instructor, status='published', course_type='coursera_plus').course
    sub = f.give_plus(student, status='cancelled')

    assert auth_client(student).post(enroll_url(course)).status_code == 402

    sub.status = 'active'
    sub.end_date = timezone.now() - timedelta(days=1)
    sub.save()
    assert auth_client(student).post(enroll_url(course)).status_code == 402


def test_plus_course_with_active_subscription_can_be_enrolled(auth_client, instructor, student):
    """An active subscription unlocks Plus courses (201)."""
    course = f.build_course(instructor, status='published', course_type='coursera_plus').course
    f.give_plus(student)

    r = auth_client(student).post(enroll_url(course))

    assert r.status_code == 201
    assert f.Enrollment.objects.filter(student=student, course=course, status='active').exists()


def test_enrolling_in_an_unpublished_course_is_a_404(auth_client, instructor, student):
    """Only published courses exist for students: draft, pending and rejected ones
    cannot be enrolled in (they used to be, and then could not be opened)."""
    client = auth_client(student)

    for status in ('draft', 'pending_review', 'rejected'):
        course = f.build_course(instructor, status=status).course

        r = client.post(enroll_url(course))

        assert r.status_code == 404, status
        assert not f.Enrollment.objects.filter(student=student, course=course).exists()
        course.refresh_from_db()
        assert course.total_enrolled == 0


def test_only_students_can_enroll_and_unknown_course_is_404(api, auth_client, instructor, student):
    """Anonymous 401, instructor 403, unknown course 404."""
    course = f.build_course(instructor, status='published').course

    assert api.post(enroll_url(course)).status_code == 401
    assert auth_client(instructor).post(enroll_url(course)).status_code == 403
    assert auth_client(student).post(f'/api/courses/{uuid.uuid4()}/enroll/').status_code == 404


# --------------------------------------------------------------------------- #
# bookmarks
# --------------------------------------------------------------------------- #
def test_bookmark_toggles(auth_client, instructor, student):
    """The bookmark endpoint toggles; instructors 403, unknown course 404."""
    course = f.make_course(instructor, status='published')
    client = auth_client(student)
    url = f'/api/courses/{course.uuid}/bookmark/'

    r = client.post(url)
    assert r.status_code == 200
    assert 'message' in r.json()
    assert f.CourseBookmark.objects.filter(student=student, course=course).count() == 1

    r = client.post(url)
    assert r.status_code == 200
    assert f.CourseBookmark.objects.filter(student=student, course=course).count() == 0

    assert auth_client(instructor).post(url).status_code == 403
    assert client.post(f'/api/courses/{uuid.uuid4()}/bookmark/').status_code == 404


# --------------------------------------------------------------------------- #
# my courses
# --------------------------------------------------------------------------- #
def test_enrolled_courses_lists_active_enrollments_with_progress(auth_client, instructor, student, other_student):
    """My-courses lists active enrolments only, with progress and lesson counts."""
    first = f.build_course(instructor, status='published', title='First')
    second = f.build_course(instructor, status='published', title='Second')
    done = f.build_course(instructor, status='published', title='Done')
    f.enroll(student, first.course)
    f.enroll(student, second.course)
    f.enroll(student, done.course, status='completed')
    f.enroll(other_student, first.course)

    # complete one lecture of "first" through the API
    client = auth_client(student)
    r = client.post(f'/api/courses/{first.course.uuid}/lectures/{first.video.uuid}/complete/')
    assert r.status_code == 200

    r = client.get(ENROLLED)

    assert r.status_code == 200
    rows = {row['course_id']: row for row in r.json()}
    # current behaviour: only *active* enrollments are listed
    assert set(rows) == {str(first.course.uuid), str(second.course.uuid)}
    row = rows[str(first.course.uuid)]
    assert set(row) == {'id', 'course_id', 'title', 'instructor', 'thumbnail', 'progress',
                        'last_accessed', 'next_lesson', 'total_lessons', 'completed_lessons',
                        'estimated_completion'}
    assert row['total_lessons'] == 4
    assert row['completed_lessons'] == 1
    assert row['progress'] == pytest.approx(25.0)
    assert row['next_lesson']


def test_enrolled_courses_is_student_only(api, auth_client, instructor):
    """Anonymous 401, instructors 403."""
    assert api.get(ENROLLED).status_code == 401
    assert auth_client(instructor).get(ENROLLED).status_code == 403


# --------------------------------------------------------------------------- #
# Plus preview
# --------------------------------------------------------------------------- #
def test_plus_preview_for_student_without_subscription(auth_client, instructor, student):
    """Preview lists published Plus courses plus benefits and pricing."""
    plus = f.make_course(instructor, status='published', course_type='coursera_plus', title='Plus course')
    f.make_course(instructor, status='published', course_type='free', title='Free course')
    f.make_course(instructor, status='draft', course_type='coursera_plus', title='Draft plus')

    r = auth_client(student).get(PLUS_PREVIEW)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'preview_courses', 'benefits', 'pricing', 'checkout_url'}
    assert [c['id'] for c in body['preview_courses']] == [str(plus.uuid)]
    assert set(body['preview_courses'][0]) == {'id', 'title', 'instructor', 'thumbnail', 'rating',
                                               'students', 'duration', 'level', 'category',
                                               'description'}
    assert body['benefits']['total_plus_courses'] == 1
    assert body['benefits']['total_free_courses'] == 1
    assert {'monthly', 'yearly', 'yearly_savings', 'yearly_savings_percentage'} <= set(body['pricing'])


def test_plus_preview_for_subscriber_and_for_non_students(auth_client, api, instructor, student):
    """Subscribers get a message, non-students 403, anonymous 401."""
    f.give_plus(student)

    r = auth_client(student).get(PLUS_PREVIEW)
    assert r.status_code == 200
    assert 'message' in r.json()
    assert 'preview_courses' not in r.json()

    assert auth_client(instructor).get(PLUS_PREVIEW).status_code == 403
    assert api.get(PLUS_PREVIEW).status_code == 401
