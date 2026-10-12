"""Subscription lifecycle driven by Stripe events."""
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.core.events import emit, payment_failed, subscription_activated, subscription_renewed

from ..models import StudentPlusPayment, StudentPlusSubscription
from . import gateway

logger = logging.getLogger(__name__)

PERIODS = {
    'monthly': timedelta(days=30),
    'yearly': timedelta(days=365),
}


def _user_of_customer(customer_id):
    User = get_user_model()
    return User.objects.get(email=gateway.customer_email(customer_id))


def activate_from_checkout(session):
    """``checkout.session.completed``: activate (or re-activate) the subscription."""
    User = get_user_model()
    user_id = session.get('client_reference_id')
    customer_email = session.get('customer_email')
    plan_id = session.get('metadata', {}).get('plan_id', 'monthly')

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
    if subscription is not None:
        if subscription.is_active():
            logger.info('User %s already has an active subscription', user.email)
            return subscription
        # Reactivate a cancelled subscription
        subscription.status = 'active'
        subscription.save()
    else:
        subscription_type = 'monthly' if plan_id == 'monthly' else 'yearly'
        start_date = timezone.now()
        end_date = start_date + PERIODS[subscription_type]
        subscription = StudentPlusSubscription.objects.create(
            student=user,
            subscription_type=subscription_type,
            status='active',
            start_date=start_date,
            end_date=end_date,
            next_billing_date=end_date,
            payment_method='stripe',
            last_payment_date=start_date
        )

    amount = session['amount_total'] / 100  # Stripe amounts are in cents
    StudentPlusPayment.objects.create(
        subscription=subscription,
        amount=amount,
        status='completed',
        payment_method='stripe',
        transaction_id=session['payment_intent'] or session['id']
    )

    emit(subscription_activated, user=user, subscription=subscription, amount=amount)
    return subscription


def renew_from_invoice(invoice):
    """``invoice.payment_succeeded``: record the payment and move the billing date."""
    customer_id = invoice.get('customer')
    amount_paid = invoice.get('amount_paid', 0) / 100  # Stripe amounts are in cents

    try:
        user = _user_of_customer(customer_id)
        subscription = StudentPlusSubscription.objects.get(student=user)
    except get_user_model().DoesNotExist:
        logger.warning('Renewal: user not found for customer %s', customer_id)
        return None
    except StudentPlusSubscription.DoesNotExist:
        logger.warning('Renewal: subscription not found for customer %s', customer_id)
        return None

    start_date = timezone.now()
    end_date = start_date + PERIODS.get(subscription.subscription_type, PERIODS['yearly'])

    subscription.last_payment_date = start_date
    subscription.next_billing_date = end_date
    subscription.status = 'active'
    subscription.save()

    StudentPlusPayment.objects.create(
        subscription=subscription,
        amount=amount_paid,
        status='completed',
        payment_method='stripe',
        transaction_id=invoice.get('payment_intent') or invoice.get('id')
    )

    emit(subscription_renewed, user=user, subscription=subscription, next_billing_date=end_date)
    return subscription


def record_failed_payment(invoice):
    """``invoice.payment_failed``: record it and warn / suspend depending on the attempt."""
    customer_id = invoice.get('customer')
    amount_due = invoice.get('amount_due', 0) / 100  # Stripe amounts are in cents
    attempt_count = invoice.get('attempt_count', 1)

    try:
        user = _user_of_customer(customer_id)
        subscription = StudentPlusSubscription.objects.get(student=user)
    except get_user_model().DoesNotExist:
        logger.warning('Failed payment: user not found for customer %s', customer_id)
        return None
    except StudentPlusSubscription.DoesNotExist:
        logger.warning('Failed payment: subscription not found for customer %s', customer_id)
        return None

    StudentPlusPayment.objects.create(
        subscription=subscription,
        amount=amount_due,
        status='failed',
        payment_method='stripe',
        transaction_id=invoice.get('id')
    )

    if attempt_count == 1:
        # First failure - warn the user, keep the subscription active (grace period)
        outcome = 'warning'
        subscription.status = 'active'
    elif attempt_count >= 3:
        # Multiple failures - suspend the subscription
        outcome = 'suspended'
        subscription.status = 'suspended'
    else:
        # Intermediate failure - keep active during the retry period
        outcome = 'retrying'
        subscription.status = 'active'
    subscription.save()

    emit(payment_failed, user=user, subscription=subscription, attempt_count=attempt_count,
         amount_due=amount_due, outcome=outcome)
    return subscription
