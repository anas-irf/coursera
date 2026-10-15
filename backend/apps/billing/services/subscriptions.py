"""Subscription lifecycle: what Stripe tells us, and the student cancelling.

Stripe delivers an event at least once, so every handler first asks whether the payment it
would record is already there; a handler that fails raises, the webhook answers 5xx and Stripe
sends the event again.  Money is ``Decimal`` from the cents Stripe reports.
"""
import logging
from datetime import UTC, datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.core.api.errors import ServiceError
from apps.core.events import emit, payment_failed, subscription_activated, subscription_renewed

from .. import plans
from ..models import StudentPlusPayment, StudentPlusSubscription
from . import gateway

logger = logging.getLogger(__name__)

PROVIDER_ERROR = 'The payment provider could not process this request. Please try again later.'
TOLERATED_FAILED_ATTEMPTS = 3   # the third failed payment of an invoice suspends the subscription


def dollars(cents):
    """Stripe reports cents; money is a ``Decimal`` of dollars with two places."""
    return (Decimal(int(cents or 0)) / 100).quantize(Decimal('0.01'))


def _recorded(transaction_id):
    return bool(transaction_id) and StudentPlusPayment.objects.filter(transaction_id=transaction_id).exists()


def _period_end(subscription_type, invoice, start):
    """End of the period an invoice pays for: Stripe's own date when it carries one, else one period."""
    try:
        end = datetime.fromtimestamp(int(invoice['lines']['data'][0]['period']['end']), tz=UTC)
        if end > start:
            return end
    except (KeyError, IndexError, TypeError, ValueError, OverflowError):
        pass
    return start + plans.PERIOD.get(subscription_type, plans.PERIOD['yearly'])


def _subscription_of(stripe_subscription_id, customer_id):
    """The local subscription a Stripe object belongs to (``None`` when we cannot tell)."""
    rows = StudentPlusSubscription.objects.select_related('student')
    if stripe_subscription_id:
        found = rows.filter(stripe_subscription_id=stripe_subscription_id).first()
        if found is not None:
            return found
    if customer_id:
        found = rows.filter(stripe_customer_id=customer_id).first()
        if found is not None:
            return found
        # rows made before the ids were stored: the Stripe customer's e-mail is the link
        user = get_user_model().objects.filter(email=gateway.customer_email(customer_id)).first()
        if user is not None:
            return rows.filter(student=user).first()
    return None


def _remember_stripe_ids(subscription, subscription_id, customer_id):
    """Keep the Stripe ids on the row (the caller saves it): cancelling needs them."""
    if subscription_id:
        subscription.stripe_subscription_id = subscription_id
    if customer_id:
        subscription.stripe_customer_id = customer_id


# --------------------------------------------------------------------------- #
# Stripe -> us
# --------------------------------------------------------------------------- #
@transaction.atomic
def activate_from_checkout(session):
    """``checkout.session.completed``: activate (or re-activate) the subscription."""
    User = get_user_model()
    user_id = session.get('client_reference_id')
    customer_email = session.get('customer_email')
    plan_id = (session.get('metadata') or {}).get('plan_id', 'monthly')

    # Find the user: by the uuid we sent to Stripe, else by e-mail
    user = None
    if user_id:
        user = User.objects.filter(uuid=user_id).first()
    if user is None and customer_email:
        user = User.objects.filter(email=customer_email).first()
    if user is None:
        logger.warning('Checkout %s: no user found (client_reference_id=%s, email=%s)',
                       session.get('id'), user_id, customer_email)
        return None

    subscription = StudentPlusSubscription.objects.filter(student=user).first()
    transaction_id = session.get('payment_intent') or session.get('id')
    if _recorded(transaction_id):
        return subscription     # this event was handled already (a retry, or verify-session got there first)

    subscription_type = 'monthly' if plan_id == 'monthly' else 'yearly'
    now = timezone.now()
    end = now + plans.PERIOD[subscription_type]
    ids = {
        'stripe_customer_id': session.get('customer') or '',
        'stripe_subscription_id': session.get('subscription') or '',
    }
    amount = dollars(session.get('amount_total'))

    if subscription is not None and subscription.is_active() and subscription.status == 'active':
        # a second checkout while one is running: the payment is real, what runs is left alone
        logger.warning('User %s already has an active subscription; recording the payment only', user.email)
        StudentPlusPayment.objects.create(
            subscription=subscription, amount=amount, status='completed',
            payment_method='stripe', transaction_id=transaction_id)
        return subscription

    if subscription is None:
        subscription = StudentPlusSubscription.objects.create(
            student=user, subscription_type=subscription_type, status='active', start_date=now,
            end_date=end, next_billing_date=end, payment_method='stripe', last_payment_date=now,
            **{key: value for key, value in ids.items() if value})
    else:
        # a lapsed or cancelled one starts a new period, of the plan that was just bought
        subscription.subscription_type = subscription_type
        subscription.status = 'active'
        subscription.auto_renew = True
        subscription.start_date = now
        subscription.end_date = end
        subscription.next_billing_date = end
        subscription.last_payment_date = now
        for key, value in ids.items():
            if value:
                setattr(subscription, key, value)
        subscription.save()

    StudentPlusPayment.objects.create(
        subscription=subscription, amount=amount, status='completed',
        payment_method='stripe', transaction_id=transaction_id)

    emit(subscription_activated, user=user, subscription=subscription, amount=amount)
    return subscription


@transaction.atomic
def renew_from_invoice(invoice):
    """``invoice.payment_succeeded``: record the payment and move the period forward."""
    if invoice.get('billing_reason') == 'subscription_create':
        return None     # the first payment of a subscription is the checkout's: not a renewal

    subscription = _subscription_of(invoice.get('subscription'), invoice.get('customer'))
    if subscription is None:
        logger.warning('Renewal: no subscription for customer %s', invoice.get('customer'))
        return None

    transaction_id = invoice.get('payment_intent') or invoice.get('id')
    if _recorded(transaction_id):
        return subscription

    now = timezone.now()
    end = _period_end(subscription.subscription_type, invoice, now)
    amount = dollars(invoice.get('amount_paid'))

    subscription.status = 'active'
    subscription.auto_renew = True
    subscription.last_payment_date = now
    subscription.end_date = end
    subscription.next_billing_date = end
    _remember_stripe_ids(subscription, invoice.get('subscription'), invoice.get('customer'))
    subscription.save()

    StudentPlusPayment.objects.create(
        subscription=subscription, amount=amount, status='completed',
        payment_method='stripe', transaction_id=transaction_id)

    emit(subscription_renewed, user=subscription.student, subscription=subscription,
         next_billing_date=end)
    return subscription


@transaction.atomic
def record_failed_payment(invoice):
    """``invoice.payment_failed``: record the attempt and warn, or suspend on the third."""
    subscription = _subscription_of(invoice.get('subscription'), invoice.get('customer'))
    if subscription is None:
        logger.warning('Failed payment: no subscription for customer %s', invoice.get('customer'))
        return None

    attempt_count = invoice.get('attempt_count') or 1
    # an invoice is retried: each attempt is its own record (the invoice id alone is not unique)
    transaction_id = f"{invoice.get('id')}:{attempt_count}"
    if _recorded(transaction_id):
        return subscription

    amount_due = dollars(invoice.get('amount_due'))
    StudentPlusPayment.objects.create(
        subscription=subscription, amount=amount_due, status='failed',
        payment_method='stripe', transaction_id=transaction_id)

    if attempt_count >= TOLERATED_FAILED_ATTEMPTS:
        outcome = 'suspended'
        subscription.status = 'suspended'
    elif attempt_count == 1:
        # first failure: warn, keep the subscription running (grace period)
        outcome = 'warning'
        subscription.status = 'active'
    else:
        outcome = 'retrying'
        subscription.status = 'active'
    _remember_stripe_ids(subscription, invoice.get('subscription'), invoice.get('customer'))
    subscription.save()

    emit(payment_failed, user=subscription.student, subscription=subscription,
         attempt_count=attempt_count, amount_due=amount_due, outcome=outcome)
    return subscription


@transaction.atomic
def sync_from_stripe(stripe_subscription, *, ended=False):
    """``customer.subscription.updated`` / ``.deleted``: mirror a change made at Stripe.

    Cancelling at the period end (from the dashboard or from our own button) stops the renewal
    but not the access; the subscription ending is what closes it.
    """
    subscription = _subscription_of(stripe_subscription.get('id'), stripe_subscription.get('customer'))
    if subscription is None:
        return None

    if ended:
        subscription.status = 'expired'
        subscription.auto_renew = False
        subscription.next_billing_date = None
    elif stripe_subscription.get('cancel_at_period_end'):
        subscription.auto_renew = False
        if subscription.status == 'active':
            subscription.status = 'cancelled'
    elif subscription.status == 'cancelled' and subscription.is_active():
        # resumed at Stripe before the period ended
        subscription.status = 'active'
        subscription.auto_renew = True
    _remember_stripe_ids(subscription, stripe_subscription.get('id'), stripe_subscription.get('customer'))
    subscription.save()
    return subscription


HANDLERS = {
    'checkout.session.completed': activate_from_checkout,
    'invoice.payment_succeeded': renew_from_invoice,
    'invoice.payment_failed': record_failed_payment,
    'customer.subscription.updated': sync_from_stripe,
    'customer.subscription.deleted': lambda subscription: sync_from_stripe(subscription, ended=True),
}


def handle_event(event):
    """Run the handler of a Stripe event; an event type nobody handles is ignored."""
    event_type = event.get('type')
    handler = HANDLERS.get(event_type)
    if handler is None:
        logger.info('Unhandled Stripe event type: %s', event_type)
        return None
    return handler(event['data']['object'])


# --------------------------------------------------------------------------- #
# the student
# --------------------------------------------------------------------------- #
def cancel(subscription):
    """Stop the subscription renewing: at Stripe first, then here.

    The student keeps Plus until the end of the period they paid for (``end_date``).  A
    subscription without a Stripe id (created before the ids were stored) is cancelled here
    only, and the missing id is logged so it can be stopped in the dashboard.
    """
    if subscription.status in ('cancelled', 'expired'):
        return subscription

    if subscription.stripe_subscription_id:
        try:
            gateway.cancel_at_period_end(subscription.stripe_subscription_id)
        except gateway.StripeError:
            logger.exception('Stripe refused to cancel subscription %s', subscription.stripe_subscription_id)
            raise ServiceError(PROVIDER_ERROR) from None
    else:
        logger.warning('Subscription %s has no Stripe id: cancelled here, stop it at Stripe too',
                       subscription.pk)

    subscription.status = 'cancelled'
    subscription.auto_renew = False
    subscription.save()
    return subscription
