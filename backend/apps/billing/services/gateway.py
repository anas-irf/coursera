"""The only module that talks to Stripe."""
import stripe
from django.conf import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

StripeError = stripe.error.StripeError
SignatureVerificationError = stripe.error.SignatureVerificationError


def create_checkout_session(user, offer):
    """Create a Stripe checkout session for ``offer`` (a ``billing.plans.Offer``)."""
    return stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {
                    'name': offer.name,
                    'description': f'Access to all Coursera Plus courses - {offer.cycle} subscription',
                },
                'unit_amount': offer.cents,
                'recurring': {
                    'interval': offer.interval,
                },
            },
            'quantity': 1,
        }],
        mode='subscription',
        success_url=(f'{settings.FRONTEND_URL}/student/dashboard?success=true&plan={offer.cycle}'
                     '&session_id={CHECKOUT_SESSION_ID}'),
        cancel_url=f'{settings.FRONTEND_URL}/student/checkout?cancelled=true',
        client_reference_id=str(user.uuid),
        customer_email=user.email,
        metadata={
            'user_id': str(user.uuid),
            'plan_id': offer.cycle,
            'user_email': user.email,
        }
    )


def retrieve_session(session_id):
    return stripe.checkout.Session.retrieve(session_id)


def customer_email(customer_id):
    return stripe.Customer.retrieve(customer_id).email


def cancel_at_period_end(subscription_id):
    """Stop Stripe renewing the subscription; it stays usable until the paid period ends."""
    return stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)


def construct_event(payload, signature, secret):
    return stripe.Webhook.construct_event(payload, signature, secret)
