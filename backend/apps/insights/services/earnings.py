"""Monthly instructor earnings: what each Coursera Plus course earned of the month's pool.

The pool and its allocation are billing's (``apps.billing.services.earnings``); what only
learning data can tell is how much each course was enrolled in, completed and watched, and
that is measured here.  The month is the **cohort** of the month: the learners who enrolled in
it, followed to wherever they are when the month is calculated, once, after it ended.

Run it with ``python manage.py calculate_earnings --month YYYY-MM [--dry-run]``; the schedule is
documented in ``docs/ARCHITECTURE.md`` (the first day of every month, for the month before).
"""
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.billing.models import CourseraRevenuePool, InstructorEarning
from apps.billing.services import earnings as billing
from apps.courses.models import Course
from apps.learning.models import Enrollment, LectureProgress


def engagement_score(completion_rate, watch_minutes, enrollments):
    """0-100: completion counts 40 %, watch time 40 % (1000 minutes is full marks), size 20 %."""
    completion = Decimal(completion_rate) * 100
    watch = min(Decimal(watch_minutes) / Decimal('1000'), Decimal('100'))
    size = min(Decimal(enrollments) / Decimal('100'), Decimal('100'))
    return min(completion * Decimal('0.4') + watch * Decimal('0.4') + size * Decimal('0.2'), Decimal('100'))


def performance_multiplier(completion_rate, score):
    """0.5 - 2.0: high completion and engagement are worth more, a course nobody finishes less."""
    multiplier = Decimal('1.0')

    if completion_rate > 0.8:
        multiplier += Decimal('0.5')
    elif completion_rate > 0.6:
        multiplier += Decimal('0.3')
    elif completion_rate > 0.4:
        multiplier += Decimal('0.1')

    if score > 80:
        multiplier += Decimal('0.3')
    elif score > 60:
        multiplier += Decimal('0.2')
    elif score > 40:
        multiplier += Decimal('0.1')

    if completion_rate < 0.2 and score < 30:
        multiplier = Decimal('0.5')

    return min(multiplier, Decimal('2.0'))


def course_shares(month):
    """The measured cohort of every Plus course that had enrollments in ``month``."""
    start, end = billing.month_start(month), billing.next_month(month)
    courses = Course.objects.filter(
        course_type='coursera_plus', enrollments__enrolled_date__date__gte=start,
        enrollments__enrolled_date__date__lt=end,
    ).select_related('instructor').distinct().order_by('id')

    shares = []
    for course in courses:
        cohort = Enrollment.objects.filter(
            course=course, enrolled_date__date__gte=start, enrolled_date__date__lt=end)
        enrollments = cohort.count()
        completions = cohort.filter(status='completed').count()
        completion_rate = completions / enrollments if enrollments else 0

        seconds = LectureProgress.objects.filter(enrollment__in=cohort).aggregate(
            total=Sum('progress_seconds'))['total'] or 0
        minutes = seconds // 60

        score = engagement_score(completion_rate, minutes, enrollments)
        shares.append({
            'course': course,
            'enrollments': enrollments,
            'completions': completions,
            'watch_minutes': minutes,
            'engagement': score.quantize(Decimal('0.01')),
            'multiplier': performance_multiplier(completion_rate, score),
        })
    return shares


def _recorded(month, pool):
    rows = InstructorEarning.objects.filter(month=month).select_related('course').order_by('id')
    return {
        'month': month,
        'revenue': pool.total_subscription_revenue,
        'pool': pool.instructor_pool,
        'frozen': True,
        'courses': [
            {'course': row.course, 'enrollments': row.enrollments_count,
             'multiplier': row.performance_multiplier, 'amount': row.final_amount}
            for row in rows
        ],
    }


def preview(month):
    """What ``month`` records, or would record: the pool and every course's amount (nothing is written).

    A frozen month shows what was recorded, not a recomputation: later enrollments do not move it.
    """
    month = billing.month_start(month)
    frozen = CourseraRevenuePool.objects.filter(month=month, is_distributed=True).first()
    if frozen is not None:
        return _recorded(month, frozen)

    shares = course_shares(month)
    revenue = billing.plus_revenue(month)
    pool = billing.instructor_pool(revenue)
    finals = billing.allocate(pool, [s['enrollments'] * s['multiplier'] for s in shares])
    return {
        'month': month,
        'revenue': revenue,
        'pool': pool,
        'frozen': billing.month_is_frozen(month),
        'courses': [
            {'course': s['course'], 'enrollments': s['enrollments'], 'multiplier': s['multiplier'],
             'amount': amount}
            for s, amount in zip(shares, finals, strict=True)
        ],
    }


def calculate_month(month, *, now=None):
    """Calculate, record and freeze the earnings of a month that has ended."""
    month = billing.month_start(month)
    return billing.record_month(month, course_shares(month), now=now or timezone.now())
