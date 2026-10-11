from django.apps import AppConfig


class SeedingConfig(AppConfig):
    """Development tooling: demo data and local database setup.

    No models.  It sits on top of every slice (see .importlinter), is installed
    by the dev and test settings only and is never part of a production
    deployment.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.seeding'
    label = 'seeding'
    verbose_name = 'Seeding'
