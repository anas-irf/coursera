"""Arithmetic and migrations of billing that are easier to pin directly than through HTTP."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

import factories as f
from apps.billing import plans
from apps.billing.services.earnings import allocate

BEFORE = [('payments', '0002_subscription_models_from_accounts')]
AFTER = [('payments', '0003_subscription_stripe_ids_and_period_end')]


# --------------------------------------------------------------------------- #
# allocation
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('pool, weights', [
    ('100.00', [1, 1, 1]),
    ('0.01', [5, 5, 5]),
    ('179.99', [3, 7, 11, 13]),
    ('1000000.00', [1]),
    ('10.00', ['1.5', '0.5', '2.0']),
])
def test_the_cents_always_add_up_to_the_pool(pool, weights):
    shares = allocate(Decimal(pool), weights)

    assert sum(shares) == Decimal(pool)
    assert all(share >= 0 for share in shares)


def test_the_cents_left_over_go_to_the_biggest_fractions():
    # 1.00 over three equal weights: 0.33 each and one cent left, to the first of the ties
    assert allocate(Decimal('1.00'), [1, 1, 1]) == [Decimal('0.34'), Decimal('0.33'), Decimal('0.33')]
    # 0.05 over 1:2: exact 0.0166.. and 0.0333.. -> the bigger fraction gets the spare cent
    assert allocate(Decimal('0.05'), [1, 2]) == [Decimal('0.02'), Decimal('0.03')]


def test_nothing_to_share_or_nobody_to_share_with_gives_zeros():
    assert allocate(Decimal('0.00'), [1, 2]) == [Decimal('0.00'), Decimal('0.00')]
    assert allocate(Decimal('10.00'), [0, 0]) == [Decimal('0.00'), Decimal('0.00')]
    assert allocate(Decimal('10.00'), []) == []


# --------------------------------------------------------------------------- #
# plans
# --------------------------------------------------------------------------- #
def test_a_configured_plan_is_what_is_offered_and_charged(db):
    assert plans.offer('monthly').price == Decimal('49.99')          # the built-in default

    f.SubscriptionPlan.objects.create(name='Cheaper', description='x', price=Decimal('19.99'),
                                      billing_cycle='monthly')

    offered = plans.offer('monthly')
    assert offered.price == Decimal('19.99') and offered.cents == 1999
    assert offered.name == 'Cheaper'
    assert plans.offer('yearly').price == Decimal('399.99')         # the other cycle is untouched
    assert plans.offer('weekly') is None


def test_the_checkout_lists_the_plan_sold_for_each_cycle_monthly_first(db):
    f.SubscriptionPlan.objects.create(name='Annual', description='x', price=Decimal('299.88'),
                                      billing_cycle='yearly')
    f.SubscriptionPlan.objects.create(name='Old monthly', description='x', price=Decimal('9.00'),
                                      billing_cycle='monthly')
    f.SubscriptionPlan.objects.create(name='Monthly', description='x', price=Decimal('19.99'),
                                      billing_cycle='monthly')

    assert [(offer.cycle, offer.name) for offer in plans.offers()] == [('monthly', 'Monthly'), ('yearly', 'Annual')]


def test_the_yearly_savings_follow_the_prices(db):
    amount, percentage = plans.savings()
    assert amount == Decimal('199.89') and percentage == 33

    f.SubscriptionPlan.objects.create(name='Annual', description='x', price=Decimal('299.88'),
                                      billing_cycle='yearly')
    amount, percentage = plans.savings()
    assert amount == Decimal('300.00') and percentage == 50


# --------------------------------------------------------------------------- #
# payments.0003
# --------------------------------------------------------------------------- #
def migrate(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps


@pytest.mark.django_db(transaction=True)
def test_renewed_subscriptions_get_the_end_date_they_paid_for():
    """A renewal used to move ``next_billing_date`` and leave ``end_date`` at the first period's end."""
    renewed, settled, cancelled = f.make_student(), f.make_student(), f.make_student()
    apps = migrate(BEFORE)
    try:
        Subscription = apps.get_model('payments', 'StudentPlusSubscription')
        now = timezone.now()

        def make(student, status, end, billing):
            return Subscription.objects.create(
                student_id=student.pk, subscription_type='monthly', status=status,
                end_date=end, next_billing_date=billing).pk

        renewed_pk = make(renewed, 'active', now + timedelta(days=2), now + timedelta(days=28))
        settled_pk = make(settled, 'active', now + timedelta(days=20), now + timedelta(days=20))
        cancelled_pk = make(cancelled, 'cancelled', now + timedelta(days=2), now + timedelta(days=28))

        apps = migrate(AFTER)
        Subscription = apps.get_model('payments', 'StudentPlusSubscription')

        moved = Subscription.objects.get(pk=renewed_pk)
        assert moved.end_date == moved.next_billing_date           # what was paid for
        settled_row = Subscription.objects.get(pk=settled_pk)
        assert settled_row.end_date == settled_row.next_billing_date
        untouched = Subscription.objects.get(pk=cancelled_pk)
        assert untouched.end_date < untouched.next_billing_date     # only running subscriptions are fixed
    finally:
        migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
