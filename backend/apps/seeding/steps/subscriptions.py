"""Coursera Plus subscriptions.

A subscription is written *active* with its payment history before the
students enrol (a Plus course needs an active subscription at that moment) and
moved to its final state by ``settle`` once the activity is over: cancelled
(paid until the end date, auto-renew off) or lapsed (the end date has passed
after a failed payment).
"""
from datetime import timedelta

from apps.billing import plans
from apps.billing.models import StudentPlusPayment, StudentPlusSubscription
from apps.core.events import emit, payment_failed, subscription_activated, subscription_renewed

from ..clock import backdate, backdate_rows, notifications_at
from ..data.stories import STORIES

TITLE = 'Plus subscriptions'

PRICE = {cycle: plans.offer(cycle).price for cycle in plans.CYCLES}
PERIOD = {cycle: plans.PERIOD[cycle].days for cycle in plans.CYCLES}


def run(ctx):
    created = 0
    for story in STORIES:
        if story.plus is None:
            continue
        student = ctx.users[story.email]
        if StudentPlusSubscription.objects.filter(student=student).exists():
            continue
        _subscribe(ctx, student, story.plus)
        created += 1
    ctx.count('subscriptions', created)
    ctx.say(f'   {created} subscriptions created')


def _payment_days(plus):
    """Days ago of every successful payment, oldest first."""
    period = PERIOD[plus.plan]
    days = [plus.since - period * k for k in range(plus.since // period + 1)]
    if plus.final == 'lapsed':
        days = days[:-1]      # the most recent charge is the one that failed
    return days


def _subscribe(ctx, student, plus):
    period = PERIOD[plus.plan]
    price = PRICE[plus.plan]
    start = ctx.ago(plus.since)
    payments = _payment_days(plus)

    subscription = StudentPlusSubscription.objects.create(
        student=student, subscription_type=plus.plan, status='active', start_date=start,
        end_date=ctx.now + timedelta(days=30),      # settled at the end of the run
        next_billing_date=ctx.now + timedelta(days=30), auto_renew=True, payment_method='stripe',
        last_payment_date=ctx.ago(payments[-1]))
    backdate(subscription, created_at=start, updated_at=ctx.ago(payments[-1]))

    for number, days in enumerate(payments):
        when = ctx.ago(days)
        payment = StudentPlusPayment.objects.create(
            subscription=subscription, amount=price, status='completed', payment_method='stripe',
            transaction_id=f'pi_seed_{student.uuid.hex[:12]}_{number}')
        backdate(payment, payment_date=when, created_at=when, updated_at=when)
        with notifications_at(when):
            if number == 0:
                emit(subscription_activated, user=student, subscription=subscription, amount=price)
            else:
                emit(subscription_renewed, user=student, subscription=subscription,
                     next_billing_date=when + timedelta(days=period))


def settle(ctx):
    """Move every subscription to the state its story ends in."""
    for story in STORIES:
        if story.plus is None or story.plus.final == 'active':
            continue
        student = ctx.users[story.email]
        subscription = StudentPlusSubscription.objects.filter(student=student).first()
        if subscription is None:
            continue
        plus = story.plus
        period = PERIOD[plus.plan]
        last_paid = ctx.ago(_payment_days(plus)[-1])
        ends = last_paid + timedelta(days=period)

        if plus.final == 'cancelled':
            backdate_rows(StudentPlusSubscription.objects.filter(pk=subscription.pk),
                          status='cancelled', auto_renew=False, end_date=ends, next_billing_date=None,
                          updated_at=ctx.ago(2))
        elif plus.final == 'lapsed':
            backdate_rows(StudentPlusSubscription.objects.filter(pk=subscription.pk),
                          end_date=ends, next_billing_date=ends, last_payment_date=last_paid,
                          updated_at=ends)
            if plus.failed_payment and not subscription.payments.filter(status='failed').exists():
                _failed_payment(ctx, student, subscription, ends)


def _failed_payment(ctx, student, subscription, when):
    price = PRICE[subscription.subscription_type]
    payment = StudentPlusPayment.objects.create(
        subscription=subscription, amount=price, status='failed', payment_method='stripe',
        transaction_id=f'in_seed_{student.uuid.hex[:12]}_failed')
    backdate(payment, payment_date=when, created_at=when, updated_at=when)
    with notifications_at(when):
        emit(payment_failed, user=student, subscription=subscription, attempt_count=3,
             amount_due=price, outcome='suspended')
