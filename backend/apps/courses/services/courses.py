"""Course level use-cases."""
from apps.core.api.errors import ServiceError

from .. import extensions


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
