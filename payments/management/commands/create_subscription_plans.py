# payments/management/commands/create_subscription_plans.py
from django.core.management.base import BaseCommand
from payments.models import SubscriptionPlan


class Command(BaseCommand):
    help = 'Create default subscription plans for Coursera Plus'

    def handle(self, *args, **options):
        # Create monthly plan
        monthly_plan, created = SubscriptionPlan.objects.get_or_create(
            billing_cycle='monthly',
            defaults={
                'name': 'Coursera Plus Monthly',
                'description': 'Access to all Plus courses with monthly billing. Cancel anytime.',
                'price': 49.99,
                'unlimited_courses': True,
                'certificate_included': True,
                'download_enabled': True,
                'is_active': True
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created monthly plan: {monthly_plan.name}')
            )
        else:
            self.stdout.write(f'Monthly plan already exists: {monthly_plan.name}')

        # Create yearly plan
        yearly_plan, created = SubscriptionPlan.objects.get_or_create(
            billing_cycle='yearly',
            defaults={
                'name': 'Coursera Plus Annual',
                'description': 'Access to all Plus courses with annual billing. Save 20% compared to monthly!',
                'price': 399.99,
                'unlimited_courses': True,
                'certificate_included': True,
                'download_enabled': True,
                'is_active': True
            }
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created yearly plan: {yearly_plan.name}')
            )
        else:
            self.stdout.write(f'Yearly plan already exists: {yearly_plan.name}')

        # Summary
        total_plans = SubscriptionPlan.objects.filter(is_active=True).count()
        self.stdout.write(
            self.style.SUCCESS(f'Total active subscription plans: {total_plans}')
        )