from django.apps import AppConfig


class LearningConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.learning'
    # the database tables, migrations and content types were created as "enrollments"
    label = 'enrollments'
    verbose_name = 'Learning'

    def ready(self):
        from . import hooks
        hooks.register()
