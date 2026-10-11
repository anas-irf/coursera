"""Back-dating: the services stamp "now", the seed wants "three weeks ago".

``created_at`` / ``updated_at`` / ``submitted_at`` ... are ``auto_now`` fields
and ignore values passed to ``save()``, so the dates are written afterwards
with queryset updates (which do not run ``save()`` or its validation).
"""
from contextlib import contextmanager

from django.utils import timezone

from apps.notifications.models import Notification


def backdate(instance, **fields):
    """Write ``fields`` of one row directly and mirror them on ``instance``."""
    type(instance).objects.filter(pk=instance.pk).update(**fields)
    for name, value in fields.items():
        setattr(instance, name, value)
    return instance


def backdate_rows(queryset, **fields):
    """Write ``fields`` on every row of ``queryset``; returns how many were touched."""
    return queryset.update(**fields)


@contextmanager
def notifications_at(when):
    """Give the notifications created inside the block the timestamp ``when``.

    Services emit events that create notifications "now"; the story they belong
    to happened earlier.  Everything created since the block was entered is moved.
    """
    started = timezone.now()
    yield
    Notification.objects.filter(created_at__gte=started).update(created_at=when, updated_at=when)
