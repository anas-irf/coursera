"""App configuration of the courses slice."""

from django.apps import AppConfig


class CoursesConfig(AppConfig):
    """The courses slice: courses, their curriculum and the publishing workflow."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.courses'
    verbose_name = 'Courses'
