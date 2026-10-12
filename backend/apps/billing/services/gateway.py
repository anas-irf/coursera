"""The only module that talks to Stripe."""
import stripe
from django.conf import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

StripeError = stripe.error.StripeError
SignatureVerificationError = stripe.error.SignatureVerificationError

# plan id -> checkout line item (prices in cents)
CHECKOUT_PLANS = {
    'monthly': {
        'name': 'Coursera Plus Monthly',
        'price': 4999,  # $49.99
        'billing_cycle': 'monthly',
        'interval': 'month'
    },
    'yearly': {
        'name': 'Coursera Plus Annual',
        'price': 39999,  # $399.99
        'billing_cycle': 'yearly',
        'interval': 'year'
    }
}


def create_checkout_session(user, plan_id):
    """Create a Stripe checkout session for the Plus plan ``plan_id``."""
    plan = CHECKOUT_PLANS[plan_id]
    return stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {
                    'name': plan['name'],
                    'description': f'Access to all Coursera Plus courses - {plan["billing_cycle"]} subscription',
                },
                'unit_amount': plan['price'],
                'recurring': {
                    'interval': plan['interval'],
                },
            },
            'quantity': 1,
        }],
        mode='subscription',
        success_url=(f'{settings.FRONTEND_URL}/student/dashboard?success=true&plan={plan_id}'
                     '&session_id={CHECKOUT_SESSION_ID}'),
        cancel_url=f'{settings.FRONTEND_URL}/student/checkout?cancelled=true',
        client_reference_id=str(user.uuid),
        customer_email=user.email,
        metadata={
            'user_id': str(user.uuid),
            'plan_id': plan_id,
            'user_email': user.email,
        }
    )


def retrieve_session(session_id):
    return stripe.checkout.Session.retrieve(session_id)


def customer_email(customer_id):
    return stripe.Customer.retrieve(customer_id).email


def construct_event(payload, signature, secret):
    return stripe.Webhook.construct_event(payload, signature, secret)
