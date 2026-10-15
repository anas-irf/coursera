from django.apps import AppConfig


class CertificatesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.certificates'
    verbose_name = 'Certificates'

    def ready(self):
        # certificates are issued by reacting to course / grading events
        from . import receivers  # noqa: F401
