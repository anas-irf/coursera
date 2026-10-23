"""Read side of billing: who is subscribed, what the plans are."""
from django.db.models import Q
from django.utils import timezone

from . import plans
from .models import StudentPlusSubscription, SubscriptionPlan


def members(*, now=None):
    """Subscriptions that give Plus right now: running, or cancelled within the period paid for."""
    now = now or timezone.now()
    return StudentPlusSubscription.objects.filter(
        status__in=StudentPlusSubscription.ACCESS_STATUSES,
    ).filter(Q(end_date__isnull=True) | Q(end_date__gt=now))


def admin_plans():
    """Both plans as the administrator edits them: what is sold, whether it is configured, who has it."""
    counts = {cycle: members().filter(subscription_type=cycle).count() for cycle in plans.CYCLES}
    rows = []
    for cycle in plans.CYCLES:
        offer = plans.offer(cycle)
        rows.append({
            'cycle': cycle,
            'name': offer.name,
            'description': offer.description,
            'price': float(offer.price),
            'configured': SubscriptionPlan.objects.filter(billing_cycle=cycle, is_active=True).exists(),
            'members': counts[cycle],
        })
    return rows


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
