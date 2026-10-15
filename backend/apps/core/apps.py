"""App configuration of the core slice."""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    """The core slice: base model, errors, events and shared helpers."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core'
