from django.apps import AppConfig


class AssessmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.assessments'
    verbose_name = 'Assessments'

    def ready(self):
        # quiz and assignment lectures plug into the courses slice
        from . import course_extensions
        course_extensions.register()
