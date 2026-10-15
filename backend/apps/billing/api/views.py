"""HTTP adapters of billing: plans, checkout, the subscription and the Stripe webhook."""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsStudent
from apps.core.api.errors import ServiceError
from apps.core.api.params import object_body

from .. import plans, selectors
from ..services import gateway, subscriptions

logger = logging.getLogger(__name__)

# what the client is told when Stripe refuses a request; the details go to the log
PAYMENT_PROVIDER_ERROR = subscriptions.PROVIDER_ERROR


# --------------------------------------------------------------------------- #
# Checkout
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsStudent])
def checkout_page_data(request):
    """Get data needed for checkout page"""
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
    yearly_savings, yearly_savings_percentage = plans.savings()

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
            'yearly_savings_amount': float(yearly_savings),
            'yearly_savings_percentage': yearly_savings_percentage
        },
        'payment_methods': [
            {'id': 'card', 'name': 'Credit/Debit Card', 'icon': 'credit-card'},
            {'id': 'paypal', 'name': 'PayPal', 'icon': 'paypal'}
        ]
    })


@api_view(['POST'])
@permission_classes([IsStudent])
def create_stripe_checkout_session(request):
    """Create a Stripe checkout session for subscription payment"""
    # Check if user already has active subscription
    existing = selectors.get_subscription(request.user)
    if existing is not None and existing.is_active():
        return Response(
            {'error': 'You already have an active subscription'},
            status=status.HTTP_400_BAD_REQUEST
        )

    plan_id = object_body(request).get('plan_id')
    if not plan_id:
        return Response(
            {'error': 'Plan ID is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    offer = plans.offer(plan_id) if isinstance(plan_id, str) else None
    if offer is None:
        return Response(
            {'error': 'Invalid plan selected'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        checkout_session = gateway.create_checkout_session(request.user, offer)
    except gateway.StripeError:
        # Stripe's own message can carry request details (even part of the API key)
        logger.exception('Stripe rejected the checkout session request')
        return Response(
            {'error': PAYMENT_PROVIDER_ERROR},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response({
        'checkout_url': checkout_session.url,
        'session_id': checkout_session.id
    })


# --------------------------------------------------------------------------- #
# Stripe -> us
# --------------------------------------------------------------------------- #
@api_view(['POST'])
@permission_classes([])  # Stripe calls it; the signature of the payload is the credential
def stripe_webhook(request):
    """Handle Stripe webhook events.

    Without a webhook secret nothing can be verified, so nothing is accepted (503, never
    parsed).  A handler that fails answers 5xx so that Stripe delivers the event again.
    """
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret:
        logger.error('Stripe webhook refused: STRIPE_WEBHOOK_SECRET is not configured')
        return Response({'error': 'Webhook is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        event = gateway.construct_event(
            request.body, request.META.get('HTTP_STRIPE_SIGNATURE'), secret)
    except ValueError:
        return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
    except gateway.SignatureVerificationError:
        return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)

    logger.info('Stripe webhook %s (%s)', event.get('type'), event.get('id'))
    subscriptions.handle_event(event)
    return Response({'status': 'success'})


@api_view(['POST'])
@permission_classes([IsStudent])
def verify_stripe_session(request):
    """Verify Stripe session and create subscription if webhook failed"""

    session_id = object_body(request).get('session_id')
    if not session_id:
        return Response({'error': 'session_id is required'}, status=400)

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
    try:
        session = gateway.retrieve_session(session_id)
    except gateway.StripeError:
        logger.exception('Stripe could not retrieve the checkout session')
        return Response({'error': PAYMENT_PROVIDER_ERROR}, status=400)

    if session.payment_status == 'paid':
        subscriptions.activate_from_checkout(session)

        return Response({
            'message': 'Subscription created successfully',
            'has_subscription': True
        })
    return Response({
        'message': 'Session not paid yet',
        'has_subscription': False,
        'payment_status': session.payment_status
    })


# --------------------------------------------------------------------------- #
# The student's own subscription
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsStudent])
def student_subscription_status(request):
    """Get current user's subscription status"""
    return Response(selectors.subscription_status(request.user))


@api_view(['POST'])
@permission_classes([IsStudent])
def cancel_plus_subscription(request):
    """Cancel Plus: it stops renewing, and stays usable until the paid period ends."""
    subscription = selectors.get_subscription(request.user)
    if subscription is None:
        raise ServiceError('No active subscription found', status_code=status.HTTP_404_NOT_FOUND)

    subscriptions.cancel(subscription)

    return Response({
        'message': 'Subscription cancelled successfully',
        'status': subscription.status,
        'access_until': subscription.end_date.isoformat() if subscription.end_date else None,
    })
