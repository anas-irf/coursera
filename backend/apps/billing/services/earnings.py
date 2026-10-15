"""The instructors' share of the Coursera Plus revenue: the monthly pool and what each course earns.

Money in is what students paid: the completed ``StudentPlusPayment`` rows of the month.  The
instructors' pool is ``INSTRUCTOR_REVENUE_SHARE_PERCENT`` of that, and it is **conserved**: what
the courses are given adds up to the pool to the cent, whatever their performance multipliers.
A month is calculated once, after it ended, and then frozen (``is_distributed``): later
payments or enrollments do not move a figure that was reported to an instructor.

Only the figures are recorded here.  Nothing pays anybody (``is_paid`` stays false).
"""
from datetime import date, timedelta
from decimal import ROUND_DOWN, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.core.api.errors import ServiceError

from ..models import CourseraRevenuePool, InstructorEarning, StudentPlusPayment

CENT = Decimal('0.01')


def month_start(day):
    """First day of the month of ``day`` (a ``date``)."""
    return date(day.year, day.month, 1)


def next_month(month):
    return (month_start(month) + timedelta(days=32)).replace(day=1)


def plus_revenue(month):
    """What students paid for Coursera Plus in the month (completed payments only)."""
    start, end = month_start(month), next_month(month)
    total = StudentPlusPayment.objects.filter(
        status='completed', payment_date__date__gte=start, payment_date__date__lt=end,
    ).aggregate(total=Sum('amount'))['total']
    return (total or Decimal('0')).quantize(CENT)


def instructor_pool(revenue):
    """The instructors' share of ``revenue``, rounded down to the cent (never more than their share)."""
    return (revenue * settings.INSTRUCTOR_REVENUE_SHARE_PERCENT / 100).quantize(CENT, rounding=ROUND_DOWN)


def allocate(pool, weights):
    """Split ``pool`` in proportion to ``weights`` into cents that add up to exactly ``pool``.

    Largest remainder: everyone gets the whole cents of their share, and the cents that are
    left go to the biggest fractions (ties: the first one listed).
    """
    weights = [Decimal(weight) for weight in weights]
    total = sum(weights)
    if not weights or total <= 0 or pool <= 0:
        return [Decimal('0.00')] * len(weights)

    cents = int((pool / CENT).to_integral_value())
    exact = [Decimal(cents) * weight / total for weight in weights]
    whole = [int(value) for value in exact]
    left = cents - sum(whole)
    order = sorted(range(len(weights)), key=lambda index: (exact[index] - whole[index], -index), reverse=True)
    for index in order[:left]:
        whole[index] += 1
    return [Decimal(value) * CENT for value in whole]


def month_is_frozen(month):
    pool = CourseraRevenuePool.objects.filter(month=month_start(month)).first()
    return pool is not None and pool.is_distributed


def record_month(month, shares, *, now=None):
    """Record the pool of ``month`` and the earning of every course in ``shares``; freeze the month.

    ``shares`` is a list of dicts: ``course`` (its ``instructor`` is the earner), ``enrollments``,
    ``completions``, ``watch_minutes``, ``engagement`` and ``multiplier`` (0.5 to 2.0).  A
    course's weight is its enrollments times its multiplier; ``base_amount`` is its share by
    enrollments alone and ``final_amount`` the share once multipliers are applied and
    normalised, so the final amounts add up to the pool.
    """
    month = month_start(month)
    now = now or timezone.now()
    if month_is_frozen(month):
        raise ServiceError(f'{month:%B %Y} was calculated already and is frozen')
    if next_month(month) > now.date():
        raise ServiceError(f'{month:%B %Y} has not ended yet')

    revenue = plus_revenue(month)
    pool = instructor_pool(revenue)
    bases = allocate(pool, [share['enrollments'] for share in shares])
    finals = allocate(pool, [share['enrollments'] * share['multiplier'] for share in shares])

    with transaction.atomic():
        record, _ = CourseraRevenuePool.objects.update_or_create(
            month=month,
            defaults={
                'total_subscription_revenue': revenue,
                'instructor_pool': pool,
                'total_enrollments': sum(share['enrollments'] for share in shares),
                'total_watch_minutes': sum(share['watch_minutes'] for share in shares),
                'is_distributed': True,
                'distributed_date': now,
            },
        )
        if pool > 0:
            for share, base, final in zip(shares, bases, finals, strict=True):
                course = share['course']
                InstructorEarning.objects.update_or_create(
                    instructor=course.instructor, course=course, month=month,
                    defaults={
                        'earning_type': 'monthly_share',
                        'enrollments_count': share['enrollments'],
                        'completions_count': share['completions'],
                        'total_watch_minutes': share['watch_minutes'],
                        'engagement_score': share['engagement'],
                        'base_amount': base,
                        'performance_multiplier': share['multiplier'],
                        'final_amount': final,
                    },
                )
    return record
