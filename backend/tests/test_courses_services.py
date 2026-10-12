"""Course services and the extension registry (refactor step S4)."""
from decimal import Decimal

import pytest

import factories as f
from apps.core.api.errors import ServiceError
from apps.courses import extensions
from apps.courses.models import Section
from apps.courses.services import courses as course_service
from apps.courses.services import curriculum, lifecycle

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- #
# extension registry
# --------------------------------------------------------------------------- #
def test_all_four_content_types_are_registered():
    for content_type in ('video', 'reading', 'quiz', 'assignment'):
        assert extensions.get_content_handler(content_type) is not None, content_type
    assert extensions.get_content_handler('unknown') is None


def test_total_grade_weight_sums_every_graded_content_type(instructor):
    built = f.build_course(instructor, quiz_weight=Decimal('30'), assignment_weight=Decimal('50'))

    assert extensions.total_grade_weight(built.course) == Decimal('80')
    assert extensions.total_grade_weight(f.make_course(instructor)) == Decimal('0')


def test_registration_is_idempotent():
    handler = extensions.get_content_handler('quiz')
    extensions.register_content_handler(handler)
    extensions.register_content_handler(handler)

    assert [h.content_type for h in extensions.content_handlers()].count('quiz') == 1


def test_instructor_payload_has_the_same_keys_for_every_lecture_type(instructor):
    built = f.build_course(instructor)
    expected = {'quiz_settings', 'questions', 'assignment_settings', 'reading_document',
                'article_content', 'video_content', 'subtitle_file', 'existing_video_name',
                'existing_subtitle_name'}

    for lecture in built.lectures:
        payload = extensions.instructor_lecture_payload(lecture)
        assert expected <= set(payload), lecture.content_type

    quiz = extensions.instructor_lecture_payload(built.quiz_lecture)
    assert quiz['quiz_settings']['max_attempts'] == 3
    assert len(quiz['questions']) == 2
    assert quiz['video_content'] is None


def test_lecture_duration_comes_from_the_video_handler(instructor):
    section = f.make_section(f.make_course(instructor))
    video = f.make_video(section, duration=125)
    reading = f.make_reading(section)

    assert extensions.lecture_duration(video) == 125
    assert extensions.lecture_duration(reading) == 0


def test_course_row_and_lecture_enrichers_are_registered_by_higher_slices(instructor):
    course = f.make_course(instructor)
    f.make_earning(instructor, course, amount=Decimal('12.50'))
    row = extensions.enrich_course_row(course, {'id': 'x'})
    assert row['total_revenue'] == 12.5

    lecture = f.make_video(f.make_section(course))
    assert extensions.lecture_extras(lecture) == {'completion_rate': 0}


def test_enrolled_courses_are_protected_by_the_delete_guard(instructor, student):
    course = f.make_course(instructor, status='published')
    f.enroll(student, course)

    (message,) = extensions.delete_blockers(course)
    assert '1 enrolled students' in message


# --------------------------------------------------------------------------- #
# lifecycle
# --------------------------------------------------------------------------- #
def test_submit_for_review_moves_to_pending_and_clears_rejection(instructor, admin):
    built = f.build_course(instructor, status='rejected')
    built.course.rejection_reason = 'Needs work'
    built.course.rejected_by = admin
    built.course.save()

    lifecycle.submit_for_review(built.course)

    built.course.refresh_from_db()
    assert built.course.status == 'pending_review'
    assert built.course.rejection_reason is None
    assert built.course.rejected_by is None
    # the admins were told
    assert f.Notification.objects.filter(recipient=admin, notification_type='course_submission').exists()


def test_submit_for_review_validates_in_order(instructor):
    empty = f.make_course(instructor)
    with pytest.raises(ServiceError, match='at least one section'):
        lifecycle.submit_for_review(empty)

    underweight = f.build_course(instructor, status='draft', quiz_weight=Decimal('30'))
    with pytest.raises(ServiceError) as excinfo:
        lifecycle.submit_for_review(underweight.course)
    assert excinfo.value.extra == {'current_weight': 90.0, 'missing_weight': 10.0}

    published = f.build_course(instructor, status='published')
    with pytest.raises(ServiceError, match='Only draft or rejected'):
        lifecycle.submit_for_review(published.course)


def test_approve_publishes_and_reject_records_the_reason(instructor, admin):
    course = f.make_course(instructor, status='pending_review')
    lifecycle.approve(course, admin)
    course.refresh_from_db()
    assert course.status == 'published' and course.published_date is not None

    other = f.make_course(instructor, status='pending_review')
    lifecycle.reject(other, admin, '  too short  ')
    other.refresh_from_db()
    assert other.status == 'rejected'
    assert other.rejection_reason == 'too short'
    assert other.rejected_by == admin
    assert other.rejection_date is not None


def test_unpublish_only_works_for_published_courses(instructor):
    draft = f.make_course(instructor)
    with pytest.raises(ServiceError, match='Only published'):
        lifecycle.unpublish(draft)

    published = f.make_course(instructor, status='published')
    lifecycle.unpublish(published)
    published.refresh_from_db()
    assert published.status == 'draft' and published.published_date is None


# --------------------------------------------------------------------------- #
# course service
# --------------------------------------------------------------------------- #
def test_delete_course_needs_the_typed_confirmation(instructor):
    course = f.make_course(instructor, title='Doomed')

    with pytest.raises(ServiceError, match='Confirmation failed'):
        course_service.delete_course(course, instructor, 'yes please')

    title = course_service.delete_course(course, instructor, f'{instructor.email}/Doomed')
    assert title == 'Doomed'
    assert not f.Course.objects.filter(pk=course.pk).exists()


def test_delete_course_is_blocked_by_enrollments(instructor, student):
    course = f.make_course(instructor, title='Busy', status='published')
    f.enroll(student, course)

    with pytest.raises(ServiceError, match='enrolled students'):
        course_service.delete_course(course, instructor, f'{instructor.email}/Busy')

    assert f.Course.objects.filter(pk=course.pk).exists()


# --------------------------------------------------------------------------- #
# curriculum ordering
# --------------------------------------------------------------------------- #
def test_next_order_is_max_plus_one_even_when_there_are_gaps(instructor):
    course = f.make_course(instructor)
    assert curriculum.next_order(Section.objects.filter(course=course)) == 1

    f.make_section(course, order=1)
    f.make_section(course, order=5)

    assert curriculum.next_order(Section.objects.filter(course=course)) == 6


def test_resequence_closes_gaps_and_keeps_the_relative_order(instructor):
    course = f.make_course(instructor)
    a = f.make_section(course, order=2)
    b = f.make_section(course, order=7)
    c = f.make_section(course, order=9)

    curriculum.resequence(Section.objects.filter(course=course))

    assert list(Section.objects.filter(course=course).order_by('order')
                .values_list('pk', flat=True)) == [a.pk, b.pk, c.pk]
    assert list(Section.objects.filter(course=course).order_by('order')
                .values_list('order', flat=True)) == [1, 2, 3]


def test_reorder_swaps_items_and_skips_unknown_uuids(instructor):
    course = f.make_course(instructor)
    first = f.make_section(course, order=1)
    second = f.make_section(course, order=2)

    curriculum.reorder(Section.objects.filter(course=course), [
        {'uuid': str(first.uuid), 'order': 2},
        {'uuid': str(second.uuid), 'order': 1},
        {'uuid': '00000000-0000-0000-0000-000000000000', 'order': 3},
    ])

    first.refresh_from_db()
    second.refresh_from_db()
    assert (first.order, second.order) == (2, 1)
