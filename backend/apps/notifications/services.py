"""Notification use-cases: creating, listing and reading notifications."""
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from .models import Notification


def notify(recipient, notification_type, title, message, *, related=None, action_url=None):
    """Create one in-app notification for ``recipient``.

    ``related`` is an optional model instance (anything with a ``uuid``) the
    notification points at; it is stored through the generic content-type link.
    """
    content_type = None
    object_id = None
    if related is not None:
        content_type = ContentType.objects.get_for_model(related)
        object_id = str(related.uuid)

    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        content_type=content_type,
        object_id=object_id,
        action_url=action_url,
    )


def mark_as_read(notification_id, user):
    """Mark a notification of ``user`` as read; returns it or ``None``."""
    try:
        notification = Notification.objects.get(id=notification_id, recipient=user)
    except Notification.DoesNotExist:
        return None
    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save()
    return notification


def get_unread_count(user):
    """Number of unread notifications of ``user``."""
    return Notification.objects.filter(recipient=user, is_read=False).count()


def get_user_notifications(user, limit=20, include_read=True):
    """Newest notifications of ``user`` (at most ``limit``)."""
    queryset = Notification.objects.filter(recipient=user)
    if not include_read:
        queryset = queryset.filter(is_read=False)
    return queryset.order_by('-created_at')[:limit]
