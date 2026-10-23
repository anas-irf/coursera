"""What an administrator changes of the Coursera Plus plans: name, wording and price.

The newest active ``SubscriptionPlan`` row of a cycle is what is sold (``billing.plans``).  The
first change on a database that still sells the built-in plans writes both of them down first,
so that changing one plan never takes the other one off the checkout page.  A new price applies
to new checkouts only: Stripe keeps charging an existing subscription what it was sold for.
"""
from django.db import transaction

from apps.core.api.errors import NotFound

from .. import plans
from ..models import SubscriptionPlan


def _active_row(cycle):
    return SubscriptionPlan.objects.filter(billing_cycle=cycle, is_active=True).order_by('-id').first()


def _write_down_defaults():
    """Store the built-in plan of every cycle that has no configured one yet."""
    for cycle in plans.CYCLES:
        if _active_row(cycle) is None:
            default = plans.DEFAULTS[cycle]
            SubscriptionPlan.objects.create(
                billing_cycle=cycle, name=default.name, description=default.description,
                price=default.price, unlimited_courses=default.unlimited_courses,
                certificate_included=default.certificate_included, download_enabled=default.download_enabled,
                is_active=True,
            )


def update_plan(cycle, *, name, description, price):
    """Change the plan sold for ``cycle``; answers the stored row.  404 for a cycle that is not sold."""
    if cycle not in plans.CYCLES:
        raise NotFound('There is no such plan.')
    with transaction.atomic():
        _write_down_defaults()
        row = _active_row(cycle)
        row.name, row.description, row.price = name, description, price
        row.save(update_fields=['name', 'description', 'price', 'updated_at'])
    return row
