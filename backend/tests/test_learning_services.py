"""Learning services and selectors (refactor step S7)."""
from decimal import Decimal

import pytest
from django.contrib.auth.models import AnonymousUser

import factories as f
from apps.core import events
from apps.core.api.errors import NotFound, ServiceError
from apps.learning import selectors, services
from apps.learning.api import serializers

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- #
# enrolling
# --------------------------------------------------------------------------- #
def test_enroll_creates_the_enrollment_counts_it_and_announces_it(instructor, student):
    course = f.build_course(instructor, status='published').course
    seen = []
    events.student_enrolled.connect(lambda sender, **kw: seen.append(kw['enrollment']),
                                    weak=False, dispatch_uid='test-enroll')
    try:
        enrollment = services.enroll(student, course)
    finally:
        events.student_enrolled.disconnect(dispatch_uid='test-enroll')

    course.refresh_from_db()
    assert course.total_enrolled == 1
    assert enrollment.status == 'active'
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == 4
    assert seen == [enrollment]


def test_the_counter_is_incremented_in_the_database_not_from_a_stale_copy(instructor, student, other_student):
    course = f.make_course(instructor, status='published')
    stale = f.Course.objects.get(pk=course.pk)

    services.enroll(student, course)
    services.enroll(other_student, stale)  # ``stale`` still says total_enrolled == 0

    course.refresh_from_db()
    assert course.total_enrolled == 2


def test_enroll_rejects_courses_students_cannot_see(instructor, student):
    for status in ('draft', 'pending_review', 'rejected'):
        with pytest.raises(NotFound):
            services.enroll(student, f.make_course(instructor, status=status))


def test_enroll_twice_is_refused(instructor, student):
    course = f.make_course(instructor, status='published')
    services.enroll(student, course)

    with pytest.raises(ServiceError, match='Already enrolled'):
        services.enroll(student, course)


def test_plus_courses_need_an_active_subscription(instructor, student):
    course = f.make_course(instructor, status='published', course_type='coursera_plus')

    with pytest.raises(ServiceError) as excinfo:
        services.enroll(student, course)

    assert excinfo.value.status_code == 402
    payload = excinfo.value.as_payload()
    assert payload['error'] == 'Coursera Plus subscription required'
    assert payload['requires_subscription'] is True
    assert payload['course_title'] == course.title
    assert 'Upgrade to Coursera Plus' in payload['message']

    f.give_plus(student)
    assert services.enroll(student, course).status == 'active'


# --------------------------------------------------------------------------- #
# progress
# --------------------------------------------------------------------------- #
def test_complete_lecture_leaves_the_callers_enrollment_up_to_date(instructor, student):
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)

    services.complete_lecture(enrollment, bundle.video)

    assert enrollment.progress_percentage == Decimal('25.00')
    assert enrollment.last_accessed is not None


def test_complete_lecture_once_ignores_lectures_that_are_done(instructor, student):
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)
    first = services.complete_lecture_once(enrollment, bundle.video)
    stamp = first.completed_date

    again = services.complete_lecture_once(enrollment, bundle.video)

    assert again.completed_date == stamp


def test_complete_lecture_once_never_raises(instructor, student, monkeypatch):
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)

    def broken(*args, **kwargs):
        raise RuntimeError('database went away')
    monkeypatch.setattr(services, 'progress_for', broken)

    assert services.complete_lecture_once(enrollment, bundle.video) is None


def test_active_enrollment_ignores_finished_ones(instructor, student):
    course = f.make_course(instructor, status='published')
    f.enroll(student, course, status='completed')

    assert services.active_enrollment(student, course) is None


def test_toggle_bookmark(instructor, student):
    course = f.make_course(instructor, status='published')

    assert services.toggle_bookmark(student, course) is True
    assert services.toggle_bookmark(student, course) is False
    assert not f.CourseBookmark.objects.filter(student=student, course=course).exists()


# --------------------------------------------------------------------------- #
# catalogue
# --------------------------------------------------------------------------- #
def test_catalog_for_anonymous_visitors_has_no_personal_flags(instructor):
    f.make_course(instructor, status='published')
    f.make_course(instructor, status='draft')

    (course,) = selectors.catalog(AnonymousUser())

    card = serializers.catalog_card(course, student_view=False, has_plus=False)
    assert card['is_enrolled'] is False and card['is_bookmarked'] is False
    assert card['can_enroll'] is True and card['enrollment_message'] == ''
    assert card['progress'] == 0


def test_catalog_flags_what_the_student_already_did(instructor, student):
    enrolled = f.build_course(instructor, status='published', title='Enrolled').course
    f.make_course(instructor, status='published', title='Plus only', course_type='coursera_plus')
    enrollment = f.enroll(student, enrolled)
    enrollment.progress_percentage = Decimal('40')
    enrollment.save()

    cards = {c.title: serializers.catalog_card(c, student_view=True, has_plus=False)
             for c in selectors.catalog(student)}

    assert cards['Enrolled']['is_enrolled'] is True
    assert cards['Enrolled']['can_enroll'] is False
    assert cards['Enrolled']['enrollment_message'] == 'Already enrolled'
    assert cards['Enrolled']['progress'] == 40.0
    assert cards['Plus only']['can_enroll'] is False
    assert cards['Plus only']['enrollment_message'] == 'Plus subscription required'


def test_catalog_card_data_comes_from_one_query_per_page(instructor, student, django_assert_max_num_queries):
    for index in range(5):
        built = f.build_course(instructor, status='published', title=f'Course {index}')
        f.enroll(student, built.course)

    with django_assert_max_num_queries(2):
        courses = selectors.catalog(student)
        # everything a card shows is already loaded
        [serializers.catalog_card(c, student_view=True, has_plus=True) for c in courses]

    assert len(courses) == 5


# --------------------------------------------------------------------------- #
# rosters
# --------------------------------------------------------------------------- #
def test_student_directory_folds_the_courses_of_one_student(instructor, student, other_student):
    first = f.make_course(instructor, status='published', title='First')
    second = f.make_course(instructor, status='published', title='Second')
    a = f.enroll(student, first)
    b = f.enroll(student, second)
    for enrollment, progress in ((a, '20'), (b, '60')):
        enrollment.progress_percentage = Decimal(progress)
        enrollment.save()
    f.enroll(other_student, first)

    rows = {row['email']: row for row in
            serializers.student_directory(selectors.instructor_roster(instructor))}

    assert set(rows) == {student.email, other_student.email}
    assert rows[student.email]['courses_enrolled'] == '2 courses'
    assert rows[student.email]['courses_enrolled_count'] == 2
    assert rows[student.email]['progress'] == 40.0  # the average of both courses
    assert rows[other_student.email]['courses_enrolled_count'] == 1
