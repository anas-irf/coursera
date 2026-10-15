"""Read side of billing: who is subscribed, what the plans are."""
from . import plans
from .models import StudentPlusSubscription


def get_subscription(user):
    """The Coursera Plus subscription of ``user`` (``None`` when there is none)."""
    return StudentPlusSubscription.objects.filter(student=user).first()


def has_plus_access(user):
    """True for students whose Coursera Plus subscription is currently active."""
    if user.user_type != 'student':
        return False
    subscription = get_subscription(user)
    return bool(subscription and subscription.can_access_plus_courses())


def subscription_status(user):
    """Subscription facts of ``user`` as exposed by the status endpoint."""
    subscription = get_subscription(user)
    if subscription is None:
        return {
            'has_subscription': False,
            'status': 'none',
            'subscription_type': None,
            'is_active': False,
            'can_access_plus_courses': False,
            'start_date': None,
            'end_date': None,
            'auto_renew': False,
            'next_billing_date': None
        }
    return {
        'has_subscription': True,
        'status': subscription.status,
        'subscription_type': subscription.subscription_type,
        'is_active': subscription.is_active(),
        'can_access_plus_courses': subscription.can_access_plus_courses(),
        'start_date': subscription.start_date.isoformat(),
        'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
        'auto_renew': subscription.auto_renew,
        'next_billing_date': (subscription.next_billing_date.isoformat()
                              if subscription.next_billing_date else None)
    }


def plans_data():
    """The plans of the checkout page (see ``billing.plans`` for where they come from)."""
    return {
        'plans': [
            {
                'id': offer.id,
                'name': offer.name,
                'description': offer.description,
                'price': float(offer.price),
                'billing_cycle': offer.cycle,
                'billing_cycle_display': offer.cycle.capitalize(),
                'features': {
                    'unlimited_courses': offer.unlimited_courses,
                    'certificate_included': offer.certificate_included,
                    'download_enabled': offer.download_enabled,
                },
            }
            for offer in plans.offers()
        ],
        'currency': 'USD',
    }
