# billing/api/views.py
import json
import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .. import selectors
from ..services import gateway, subscriptions

logger = logging.getLogger(__name__)

# what the client is told when Stripe refuses a request; the details go to the log
PAYMENT_PROVIDER_ERROR = 'The payment provider could not process this request. Please try again later.'


# --------------------------------------------------------------------------- #
# Checkout
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkout_page_data(request):
    """Get data needed for checkout page"""

    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can access checkout'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check current subscription status
    subscription = selectors.get_subscription(request.user)
    if subscription is not None:
        current_subscription = {
            'has_subscription': True,
            'type': subscription.subscription_type,
            'status': subscription.status,
            'is_active': subscription.is_active(),
            'end_date': subscription.end_date.isoformat() if subscription.end_date else None
        }
    else:
        current_subscription = {
            'has_subscription': False,
            'type': None,
            'status': 'none',
            'is_active': False,
            'end_date': None
        }

    plans_data = selectors.plans_data()

    # Calculate savings for annual plan
    monthly_price = 49.99
    yearly_price = 399.99
    yearly_savings = (monthly_price * 12) - yearly_price
    yearly_savings_percentage = round((yearly_savings / (monthly_price * 12)) * 100)

    return Response({
        'student': {
            'name': f"{request.user.first_name} {request.user.last_name}".strip(),
            'email': request.user.email,
            'user_type': request.user.user_type
        },
        'subscription': current_subscription,
        'plans': plans_data['plans'],
        'currency': plans_data['currency'],
        'savings': {
            'yearly_savings_amount': yearly_savings,
            'yearly_savings_percentage': yearly_savings_percentage
        },
        'payment_methods': [
            {'id': 'card', 'name': 'Credit/Debit Card', 'icon': 'credit-card'},
            {'id': 'paypal', 'name': 'PayPal', 'icon': 'paypal'}
        ]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_stripe_checkout_session(request):
    """Create a Stripe checkout session for subscription payment"""

    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can create checkout sessions'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if user already has active subscription
    existing = selectors.get_subscription(request.user)
    if existing is not None and existing.is_active():
        return Response(
            {'error': 'You already have an active subscription'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response(
                {'error': 'Plan ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if plan_id not in gateway.CHECKOUT_PLANS:
            return Response(
                {'error': 'Invalid plan selected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        checkout_session = gateway.create_checkout_session(request.user, plan_id)

        return Response({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        })

    except gateway.StripeError:
        # Stripe's own message can carry request details (even part of the API key)
        logger.exception('Stripe rejected the checkout session request')
        return Response(
            {'error': PAYMENT_PROVIDER_ERROR},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception:
        logger.exception('Failed to create checkout session')
        return Response(
            {'error': 'Failed to create checkout session'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# --------------------------------------------------------------------------- #
# Stripe -> us
# --------------------------------------------------------------------------- #
def _run(handler, payload):
    """Run a subscription handler; a failure is logged and never fails the webhook."""
    try:
        handler(payload)
    except Exception:
        logger.exception('Stripe event handler %s failed', handler.__name__)


@api_view(['POST'])
@permission_classes([])  # Webhook doesn't need authentication
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        # For development, skip signature verification if no secret is set
        if endpoint_secret:
            event = gateway.construct_event(payload, sig_header, endpoint_secret)
        else:
            # For testing without webhook secret
            event = json.loads(payload)

        event_type = event['type']
        logger.info('Stripe webhook %s (%s)', event_type, event.get('id'))

        if event_type == 'checkout.session.completed':
            _run(subscriptions.activate_from_checkout, event['data']['object'])
        elif event_type == 'invoice.payment_succeeded':
            _run(subscriptions.renew_from_invoice, event['data']['object'])
        elif event_type == 'invoice.payment_failed':
            _run(subscriptions.record_failed_payment, event['data']['object'])
        else:
            logger.info('Unhandled Stripe event type: %s', event_type)

        return Response({'status': 'success'})

    except ValueError:
        return Response({'error': 'Invalid payload'}, status=400)
    except gateway.SignatureVerificationError:
        return Response({'error': 'Invalid signature'}, status=400)
    except Exception:
        logger.exception('Stripe webhook failed')
        return Response({'error': 'Webhook processing failed'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_stripe_session(request):
    """Verify Stripe session and create subscription if webhook failed"""

    if request.user.user_type != 'student':
        return Response({'error': 'Only for students'}, status=400)

    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'error': 'session_id is required'}, status=400)

    try:
        # Check if subscription already exists
        existing = selectors.get_subscription(request.user)
        if existing is not None:
            return Response({
                'message': 'Subscription already exists',
                'has_subscription': True,
                'subscription': {
                    'type': existing.subscription_type,
                    'status': existing.status,
                    'is_active': existing.is_active()
                }
            })

        # Retrieve session from Stripe
        session = gateway.retrieve_session(session_id)

        if session.payment_status == 'paid':
            _run(subscriptions.activate_from_checkout, session)

            return Response({
                'message': 'Subscription created successfully',
                'has_subscription': True
            })
        return Response({
            'message': 'Session not paid yet',
            'has_subscription': False,
            'payment_status': session.payment_status
        })

    except gateway.StripeError:
        logger.exception('Stripe could not retrieve the checkout session')
        return Response({'error': PAYMENT_PROVIDER_ERROR}, status=400)
    except Exception:
        logger.exception('verify-session failed')
        return Response({'error': 'Failed to verify the checkout session'}, status=500)


# --------------------------------------------------------------------------- #
# The student's own subscription
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_subscription_status(request):
    """Get current user's subscription status"""
    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can check subscription status'},
            status=status.HTTP_403_FORBIDDEN
        )
    return Response(selectors.subscription_status(request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_plus_subscription(request):
    """Cancel Plus subscription"""
    subscription = selectors.get_subscription(request.user)
    if subscription is None:
        return Response(
            {'error': 'No active subscription found'},
            status=status.HTTP_404_NOT_FOUND
        )

    subscription.status = 'cancelled'
    subscription.auto_renew = False
    subscription.save()

    return Response({
        'message': 'Subscription cancelled successfully'
    })
