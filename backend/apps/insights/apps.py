"""App configuration of the insights slice."""

from django.apps import AppConfig


class InsightsConfig(AppConfig):
    """The insights slice: read models for students, instructors and administrators."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.insights'
    label = 'analytics'
    verbose_name = 'Insights'
