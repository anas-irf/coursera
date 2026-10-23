"""The administrator's revenue page: Plus revenue by month, the members and the instructors' share.

A month that has been calculated has a revenue pool (``CourseraRevenuePool``, the ledger): its
gross revenue and the instructors' pool are what was recorded and frozen then.  A month without
one (the current month, before ``calculate_earnings`` ran) is read live: the completed Plus
payments of the month and the earning rows written for it so far.
"""
from django.conf import settings
from django.db.models import Count, Sum
from django.utils import timezone

from apps.billing import plans
from apps.billing import selectors as billing
from apps.billing.models import (
    CourseraRevenuePool, InstructorEarning, StudentPlusPayment, StudentPlusSubscription,
)
from apps.courses.models import Course

from .analytics import by_month, money, month_row, month_starts

PERIODS = (6, 12)
TOP_COURSES = 5
RECENT_PAYMENTS = 10
MONTHS_PER_YEAR = 12


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.email


def revenue(months=6, *, now=None):
    """The revenue page over the last ``months`` calendar months (the current one included)."""
    now = now or timezone.now()
    starts = month_starts(months, today=timezone.localdate(now))
    first = starts[0]

    completed = StudentPlusPayment.objects.filter(status='completed')
    paid = by_month(completed.filter(payment_date__date__gte=first), 'payment_date', value='amount')
    payments = by_month(completed.filter(payment_date__date__gte=first), 'payment_date')
    joined = by_month(StudentPlusSubscription.objects.filter(start_date__date__gte=first), 'start_date')
    earned = {row['month']: row['total'] for row in
              InstructorEarning.objects.filter(month__gte=first).values('month')
              .annotate(total=Sum('final_amount')).order_by()}
    ledger = {pool.month: pool for pool in CourseraRevenuePool.objects.filter(month__gte=first)}

    monthly = []
    for start in starts:
        pool = ledger.get(start)
        if pool is not None:
            gross, share, source = pool.total_subscription_revenue, pool.instructor_pool, 'ledger'
        else:
            gross, share, source = paid.get(start) or 0, earned.get(start) or 0, 'live'
        monthly.append(month_row(
            start, gross=money(gross), instructor_share=money(share),
            platform_share=money(max(gross - share, 0)), payments=payments.get(start, 0),
            new_members=joined.get(start, 0), source=source))

    current = starts[-1]
    earnings = InstructorEarning.objects.all()
    summary = {
        'gross_revenue': money(sum(row['gross'] for row in monthly)),
        'instructor_share': money(sum(row['instructor_share'] for row in monthly)),
        'platform_share': money(sum(row['platform_share'] for row in monthly)),
        'this_month': money(completed.filter(payment_date__date__gte=current)
                            .aggregate(total=Sum('amount'))['total']),
        'members': billing.members(now=now).count(),
        'renewing_members': renewing(now).count(),
        'mrr': monthly_recurring_revenue(now),
        'failed_payments': StudentPlusPayment.objects.filter(status='failed', payment_date__date__gte=first).count(),
        'earnings_paid': money(earnings.filter(is_paid=True).aggregate(total=Sum('final_amount'))['total']),
        'earnings_pending': money(earnings.filter(is_paid=False).aggregate(total=Sum('final_amount'))['total']),
    }

    return {
        'currency': 'USD',
        'months': months,
        'revenue_share_percent': settings.INSTRUCTOR_REVENUE_SHARE_PERCENT,
        'summary': summary,
        'monthly': monthly,
        'subscriptions': subscription_counts(now),
        'plans': plan_rows(now),
        'top_courses': top_courses(first),
        'recent_payments': recent_payments(),
    }


def renewing(now):
    """Members whose Plus renews at the end of the period (running, auto-renew on)."""
    return billing.members(now=now).filter(status='active', auto_renew=True)


def monthly_recurring_revenue(now):
    """What the renewing members pay per month: the monthly price, or a twelfth of the yearly one."""
    price = {cycle: plans.offer(cycle).price for cycle in plans.CYCLES}
    total = sum(
        price['monthly'] if row['subscription_type'] == 'monthly' else price['yearly'] / MONTHS_PER_YEAR
        for row in renewing(now).values('subscription_type')
    )
    return money(total)


def subscription_counts(now):
    """Every subscription row by where it stands (active, cancelled but paid, lapsed) and by cycle."""
    rows = StudentPlusSubscription.objects.all()
    access = billing.members(now=now)
    active = access.filter(status='active').count()
    cancelled = access.filter(status='cancelled').count()
    cycles = dict(rows.values_list('subscription_type').annotate(n=Count('pk')).order_by())
    return {
        'active': active,
        'cancelled': cancelled,
        'lapsed': rows.count() - active - cancelled,
        'monthly': cycles.get('monthly', 0),
        'yearly': cycles.get('yearly', 0),
    }


def plan_rows(now):
    """The plans on sale with their price and how many members have each."""
    access = billing.members(now=now)
    return [
        {
            'cycle': cycle,
            'name': plans.offer(cycle).name,
            'price': money(plans.offer(cycle).price),
            'members': access.filter(subscription_type=cycle).count(),
        }
        for cycle in plans.CYCLES
    ]


def top_courses(since):
    """The courses that earned the instructors the most since ``since`` (earning rows by month)."""
    best = list(
        InstructorEarning.objects.filter(month__gte=since).values('course')
        .annotate(total=Sum('final_amount')).order_by('-total', 'course')[:TOP_COURSES]
    )
    courses = Course.objects.select_related('instructor').annotate(n_enrollments=Count('enrollments')).in_bulk(
        [row['course'] for row in best])
    return [
        {
            'id': str(course.uuid),
            'title': course.title,
            'instructor': _name(course.instructor),
            'course_type': course.course_type,
            'earnings': money(row['total']),
            'enrollments': course.n_enrollments,
        }
        for row in best
        if (course := courses.get(row['course'])) is not None
    ]


def recent_payments():
    """The newest Plus payments, whatever happened to them."""
    rows = StudentPlusPayment.objects.select_related('subscription__student').order_by('-payment_date', '-id')
    return [
        {
            'id': str(payment.uuid),
            'student': _name(payment.subscription.student),
            'email': payment.subscription.student.email,
            'plan': payment.subscription.subscription_type,
            'amount': money(payment.amount),
            'status': payment.status,
            'date': payment.payment_date.isoformat(),
        }
        for payment in rows[:RECENT_PAYMENTS]
    ]
