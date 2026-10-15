"""App configuration of the billing slice."""

from django.apps import AppConfig


class BillingConfig(AppConfig):
    """The billing slice: Coursera Plus, payments and instructor earnings."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.billing'
    # the database tables, migrations and content types were created as "payments"
    label = 'payments'
    verbose_name = 'Billing'

    def ready(self):
        from . import course_extensions
        course_extensions.register()
