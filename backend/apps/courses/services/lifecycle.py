"""Course lifecycle: draft -> pending_review -> published | rejected (-> draft).

The only place that changes ``Course.status``.  Views call these functions; each
transition emits a domain event after the change has been saved.
"""
from django.utils import timezone

from apps.core.api.errors import ServiceError
from apps.core.events import course_approved, course_rejected, course_submitted, emit

from .. import extensions


def submit_for_review(course):
    """Instructor asks for publication (needs content and 100% grade weights)."""
    if not course.sections.exists():
        raise ServiceError('Course must have at least one section')

    total_weight = extensions.total_grade_weight(course)
    if total_weight != 100:
        raise ServiceError(
            'Course total grade weight must be exactly 100%',
            current_weight=float(total_weight),
            missing_weight=float(100 - total_weight),
        )

    if course.status not in ('draft', 'rejected'):
        raise ServiceError('Only draft or rejected courses can apply for publishing')

    course.status = 'pending_review'
    course.rejection_reason = None
    course.rejection_date = None
    course.rejected_by = None
    course.save()

    emit(course_submitted, course=course)
    return course


def approve(course, approved_by):
    """Admin publishes a course that is waiting for review."""
    course.status = 'published'
    course.published_date = timezone.now()
    course.rejection_reason = None
    course.rejection_date = None
    course.rejected_by = None
    course.save()

    emit(course_approved, course=course, approved_by=approved_by)
    return course


def reject(course, rejected_by, reason):
    """Admin sends a course back with a reason."""
    reason = reason.strip()
    course.status = 'rejected'
    course.rejection_reason = reason
    course.rejection_date = timezone.now()
    course.rejected_by = rejected_by
    course.save()

    emit(course_rejected, course=course, rejected_by=rejected_by, reason=reason)
    return course


def unpublish(course):
    """Instructor takes a published course offline (back to draft)."""
    if course.status != 'published':
        raise ServiceError('Only published courses can be unpublished')

    course.status = 'draft'
    course.published_date = None
    course.save()
    return course
