"""Creates the Coursera Plus plans from the price list in ``apps.billing.plans``."""

from django.core.management.base import BaseCommand

from apps.billing import plans
from apps.billing.models import SubscriptionPlan


class Command(BaseCommand):
    """Creates or updates the Coursera Plus plans."""
    help = 'Create default subscription plans for Coursera Plus'

    def handle(self, *args, **options):
        for cycle in plans.CYCLES:
            default = plans.DEFAULTS[cycle]
            plan, created = SubscriptionPlan.objects.get_or_create(
                billing_cycle=cycle,
                defaults={
                    'name': default.name,
                    'description': default.description,
                    'price': default.price,
                    'unlimited_courses': True,
                    'certificate_included': True,
                    'download_enabled': True,
                    'is_active': True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created {cycle} plan: {plan.name}'))
            else:
                self.stdout.write(f'{cycle.capitalize()} plan already exists: {plan.name}')

        total_plans = SubscriptionPlan.objects.filter(is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f'Total active subscription plans: {total_plans}'))
