"""The Coursera Plus plans: the one place their price, wording and period are written down.

An admin may configure ``SubscriptionPlan`` rows; the active row of a billing cycle is what is
offered and what Stripe charges.  Until a row exists the built-in default of the cycle is used,
so a fresh database sells the same two plans.  Everything that needs a plan (the checkout page,
the Stripe session, the seed, the savings of the yearly plan) goes through ``offer()``.
"""
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from .models import SubscriptionPlan

CYCLES = ('monthly', 'yearly')
STRIPE_INTERVAL = {'monthly': 'month', 'yearly': 'year'}
PERIOD = {'monthly': timedelta(days=30), 'yearly': timedelta(days=365)}


@dataclass(frozen=True)
class Offer:
    """A plan as it is offered and charged."""
    cycle: str
    name: str
    description: str
    price: Decimal
    id: str                       # what the checkout payload calls it
    unlimited_courses: bool = True
    certificate_included: bool = True
    download_enabled: bool = True

    @property
    def cents(self):
        """What Stripe is asked to charge."""
        return int((self.price * 100).quantize(Decimal('1')))

    @property
    def interval(self):
        return STRIPE_INTERVAL[self.cycle]

    @property
    def period(self):
        return PERIOD[self.cycle]


DEFAULTS = {
    'monthly': Offer(
        cycle='monthly', id='monthly', name='Coursera Plus Monthly',
        description='Access to all Plus courses with monthly billing',
        price=Decimal('49.99')),
    'yearly': Offer(
        cycle='yearly', id='yearly', name='Coursera Plus Annual',
        description='Access to all Plus courses with annual billing (Save 20%)',
        price=Decimal('399.99')),
}


def _from_row(plan):
    return Offer(
        cycle=plan.billing_cycle, id=str(plan.uuid), name=plan.name, description=plan.description,
        price=plan.price, unlimited_courses=plan.unlimited_courses,
        certificate_included=plan.certificate_included, download_enabled=plan.download_enabled)


def _sold_row(cycle):
    """The configured row sold for ``cycle``: the newest active one, ``None`` when there is none."""
    return SubscriptionPlan.objects.filter(billing_cycle=cycle, is_active=True).order_by('-id').first()


def offer(cycle):
    """The plan sold for ``cycle`` ('monthly' | 'yearly'), ``None`` for anything else."""
    if cycle not in CYCLES:
        return None
    row = _sold_row(cycle)
    return _from_row(row) if row is not None else DEFAULTS[cycle]


def offers():
    """What the checkout page lists: the plan sold for every configured cycle, else the two defaults.

    Monthly comes first whatever order the database returns (PostgreSQL moves an updated row to the end).
    """
    rows = [_sold_row(cycle) for cycle in CYCLES]
    configured = [_from_row(row) for row in rows if row is not None]
    return configured or [DEFAULTS[cycle] for cycle in CYCLES]


def savings():
    """What the yearly plan saves against twelve monthly payments: ``(amount, percentage)``."""
    monthly, yearly = offer('monthly').price, offer('yearly').price
    full_year = monthly * 12
    amount = full_year - yearly
    percentage = round(amount / full_year * 100) if full_year else 0
    return amount, percentage
