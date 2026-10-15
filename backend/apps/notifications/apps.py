"""App configuration of the notifications slice (connects the event receivers)."""

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    """The notifications slice: what users are told, driven by domain events."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'
    verbose_name = 'Notifications'

    def ready(self):
        # connect the domain-event receivers
        from . import receivers  # noqa: F401
