"""Read side of billing: who is subscribed, what the plans are."""
from .models import StudentPlusSubscription, SubscriptionPlan


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


DEFAULT_PLANS = [
    {
        'id': 'monthly',
        'name': 'Coursera Plus Monthly',
        'description': 'Access to all Plus courses with monthly billing',
        'price': 49.99,
        'billing_cycle': 'monthly',
        'billing_cycle_display': 'Monthly',
        'features': {
            'unlimited_courses': True,
            'certificate_included': True,
            'download_enabled': True
        }
    },
    {
        'id': 'yearly',
        'name': 'Coursera Plus Annual',
        'description': 'Access to all Plus courses with annual billing (Save 20%)',
        'price': 399.99,
        'billing_cycle': 'yearly',
        'billing_cycle_display': 'Yearly',
        'features': {
            'unlimited_courses': True,
            'certificate_included': True,
            'download_enabled': True
        }
    }
]


def plans_data():
    """Active subscription plans (the built-in defaults when none is configured)."""
    plans = [
        {
            'id': str(plan.uuid),
            'name': plan.name,
            'description': plan.description,
            'price': float(plan.price),
            'billing_cycle': plan.billing_cycle,
            'billing_cycle_display': plan.get_billing_cycle_display(),
            'features': {
                'unlimited_courses': plan.unlimited_courses,
                'certificate_included': plan.certificate_included,
                'download_enabled': plan.download_enabled
            }
        }
        for plan in SubscriptionPlan.objects.filter(is_active=True)
    ]
    return {
        'plans': plans or DEFAULT_PLANS,
        'currency': 'USD'
    }
