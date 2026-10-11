"""Use-cases of the learning slice: enrolling, progress and bookmarks."""
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.billing.selectors import has_plus_access
from apps.core.api.errors import NotFound, ServiceError
from apps.core.events import emit, student_enrolled
from apps.courses.models import Course

from .models import CourseBookmark, Enrollment, LectureProgress


def enroll(student, course):
    """Enroll ``student`` in a published course and tell the other slices."""
    if course.status != 'published':
        raise NotFound('Course not found')

    if Enrollment.objects.filter(course=course, student=student).exists():
        raise ServiceError('Already enrolled in this course')

    if course.course_type == 'coursera_plus' and not has_plus_access(student):
        raise ServiceError(
            'Coursera Plus subscription required',
            status_code=402,
            requires_subscription=True,
            course_type='coursera_plus',
            course_title=course.title,
            checkout_url='/checkout',  # the frontend redirects here
            message=f'Upgrade to Coursera Plus to access "{course.title}" and thousands of other courses',
        )

    with transaction.atomic():
        enrollment = Enrollment.objects.create(
            student=student,
            course=course,
            enrolled_date=timezone.now(),
        )
        Course.objects.filter(pk=course.pk).update(total_enrolled=F('total_enrolled') + 1)

    emit(student_enrolled, enrollment=enrollment)
    return enrollment


def active_enrollment(student, course):
    """The student's running enrollment in ``course`` (``None`` when there is none)."""
    return Enrollment.objects.filter(course=course, student=student, status='active').first()


def progress_for(enrollment, lecture):
    """The progress row of a lecture; rows of lectures added later are created lazily."""
    progress, _ = LectureProgress.objects.get_or_create(
        enrollment=enrollment,
        lecture=lecture,
        defaults={
            'is_completed': False,
            'progress_seconds': 0,
            'last_watched_position': 0,
            'watch_count': 0,
        },
    )
    return progress


def complete_lecture(enrollment, lecture):
    """Mark a lecture completed and refresh the enrollment's progress."""
    progress = progress_for(enrollment, lecture)
    # work on the caller's enrollment so its progress is up to date afterwards
    progress.enrollment = enrollment
    progress.mark_completed()

    enrollment.last_accessed = timezone.now()
    enrollment.save(update_fields=['last_accessed'])
    return progress


def complete_lecture_once(enrollment, lecture):
    """Complete a lecture as a side effect of another action (quiz, assignment).

    Does nothing when the lecture is already completed; never fails the action
    that triggered it.
    """
    try:
        progress = progress_for(enrollment, lecture)
        if not progress.is_completed:
            progress.enrollment = enrollment
            progress.mark_completed()
    except Exception:
        # progress tracking must not break the submission that caused it
        return None
    return progress


def toggle_bookmark(student, course):
    """Bookmark ``course`` or remove the bookmark; returns ``True`` when it is now bookmarked."""
    bookmark, created = CourseBookmark.objects.get_or_create(student=student, course=course)
    if not created:
        bookmark.delete()
    return created
