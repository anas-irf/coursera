"""Course level use-cases."""
from django.utils.text import slugify

from apps.core.api.errors import ServiceError

from .. import extensions
from ..models import Course

SLUG_MAX_LENGTH = 180  # leaves room for the "-2", "-3" ... suffix in the 200 character column


def unique_slug(title):
    """A URL slug for ``title`` that no course has yet ("intro-to-python", then "intro-to-python-2")."""
    base = slugify(title)[:SLUG_MAX_LENGTH].strip('-') or 'course'
    slug, number = base, 1
    while Course.objects.filter(slug=slug).exists():
        number += 1
        slug = f'{base}-{number}'
    return slug


def ensure_editable(course):
    """Refuse to change a published course: it is unpublished first."""
    if course.status == 'published':
        raise ServiceError(
            'Cannot edit published courses. Please unpublish the course first.',
            status=course.status,
        )


def delete_course(course, user, confirmation):
    """Permanently delete ``course`` after the typed confirmation.

    The confirmation is ``<instructor e-mail>/<course title>``.  Slices that
    hold data about the course (enrollments, ...) can veto the deletion through
    ``extensions.register_delete_guard``.
    """
    expected = f"{user.email}/{course.title}"
    if confirmation != expected:
        raise ServiceError(
            f'Confirmation failed. Please type "{expected}" to confirm deletion.')

    blockers = extensions.delete_blockers(course)
    if blockers:
        raise ServiceError(blockers[0])

    title = course.title
    course.delete()
    return title
