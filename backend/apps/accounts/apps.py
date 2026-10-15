"""App configuration of the accounts slice."""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """The accounts slice: users, roles and their profiles."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.accounts'
    verbose_name = 'Accounts'

    def ready(self):
        from . import checks  # noqa: F401  registers the system checks
