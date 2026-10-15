"""App configuration of the content slice (registers the lecture content handlers)."""

from django.apps import AppConfig


class ContentConfig(AppConfig):
    """The content slice: the video and reading lecture types."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.content'
    verbose_name = 'Lecture content'

    def ready(self):
        # video and reading lectures plug into the courses slice
        from . import course_extensions
        course_extensions.register()
