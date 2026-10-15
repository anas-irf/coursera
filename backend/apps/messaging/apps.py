"""App configuration of the messaging slice."""

from django.apps import AppConfig


class MessagingConfig(AppConfig):
    """The messaging slice: direct messages over REST and WebSockets."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.messaging'
    label = 'discussions'
    verbose_name = 'Messaging'
