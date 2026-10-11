"""Instructor earnings and the monthly revenue pools.

Nothing in the application creates ``InstructorEarning`` rows (the calculator is
not scheduled and uses a placeholder pool), so the dashboards would stay at
zero.  The rows written here follow the shape the earnings screens read: one
row per Plus course and month, paid for the older months, pending for the last
two.  Only Plus courses earn; free courses pay nothing.
"""
import random
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from django.db.models import Count, Sum

from apps.accounts.models import InstructorProfile
from apps.billing.models import CourseraRevenuePool, InstructorEarning
from apps.courses.models import Course
from apps.learning.models import Enrollment

from ..data.people import EMAILS

TITLE = 'Instructor earnings'
CENTS = Decimal('0.01')
INSTRUCTOR_SHARE = Decimal('0.40')


def month_starts(today):
    """The first-of-month dates the instructor dashboard charts.

    It steps back 30 days at a time and truncates to the first of the month, so
    the rows must use exactly these dates (they are distinct for six steps).
    """
    months = []
    for step in range(6):
        month = (today - timedelta(days=30 * (5 - step))).replace(day=1)
        if month not in months:
            months.append(month)
    return months


def _next_month(month):
    return (month + timedelta(days=32)).replace(day=1)


def _at(day, hour=9):
    return datetime.combine(day, time(hour), tzinfo=timezone.utc)


def run(ctx):
    months = month_starts(ctx.now.date())
    current = months[-1]
    pending_from = (current - timedelta(days=1)).replace(day=1)    # last month is still pending

    courses = list(Course.objects.filter(
        status='published', course_type='coursera_plus', instructor__email__in=EMAILS,
    ).select_related('instructor'))

    created = 0
    for course in courses:
        published = course.published_date.date()
        for month in months:
            end = _next_month(month) - timedelta(days=1)
            if end < published:
                continue        # the course did not exist yet
            if InstructorEarning.objects.filter(instructor=course.instructor, course=course,
                                                month=month).exists():
                continue
            _earning(ctx, course, month, end, paid=month < pending_from)
            created += 1

    pools = _pools(ctx, months, pending_from)
    _instructor_totals()

    ctx.count('earnings', created)
    ctx.count('revenue pools', pools)
    ctx.say(f'   {created} earnings and {pools} revenue pools created')


def _earning(ctx, course, month, end, *, paid):
    rng = random.Random(f'{course.slug}-{month.isoformat()}')
    window = Enrollment.objects.filter(course=course)
    new = window.filter(enrolled_date__date__gte=month, enrolled_date__date__lte=end).count()
    finished = window.filter(completed_date__date__gte=month, completed_date__date__lte=end).count()

    # the seeded learners are a handful; the platform has many more
    enrollments = new + rng.randint(6, 28)
    completions = finished + rng.randint(1, 8)
    engagement = rng.randint(45, 95)
    base = (Decimal(enrollments) * Decimal('4.20') + Decimal(completions) * Decimal('1.80')).quantize(CENTS)
    multiplier = min(Decimal('0.90') + Decimal(engagement - 45) / 100, Decimal('1.35'))
    final = (base * multiplier).quantize(CENTS)

    created = min(_at(end + timedelta(days=1)), ctx.ago(days=1))
    earning = InstructorEarning.objects.create(
        instructor=course.instructor, course=course, earning_type='monthly_share', month=month,
        enrollments_count=enrollments, completions_count=completions,
        total_watch_minutes=enrollments * rng.randint(40, 90), engagement_score=Decimal(engagement),
        base_amount=base, performance_multiplier=multiplier.quantize(CENTS), final_amount=final,
        is_paid=paid,
        payout_date=_at(end + timedelta(days=7)) if paid else None,
        payout_reference=f'PAY-{month:%Y%m}-{course.instructor_id}' if paid else '',
    )
    InstructorEarning.objects.filter(pk=earning.pk).update(created_at=created, updated_at=created)


def _pools(ctx, months, pending_from):
    created = 0
    for month in months:
        rows = InstructorEarning.objects.filter(month=month)
        totals = rows.aggregate(pool=Sum('final_amount'), enrollments=Sum('enrollments_count'),
                                minutes=Sum('total_watch_minutes'), n=Count('id'))
        if not totals['n'] or CourseraRevenuePool.objects.filter(month=month).exists():
            continue
        paid = month < pending_from
        end = _next_month(month) - timedelta(days=1)
        pool = CourseraRevenuePool.objects.create(
            month=month,
            total_subscription_revenue=(totals['pool'] / INSTRUCTOR_SHARE).quantize(CENTS),
            instructor_pool=totals['pool'], total_enrollments=totals['enrollments'],
            total_watch_minutes=totals['minutes'], is_distributed=paid,
            distributed_date=_at(end + timedelta(days=7)) if paid else None)
        CourseraRevenuePool.objects.filter(pk=pool.pk).update(
            created_at=min(_at(end + timedelta(days=1)), ctx.ago(days=1)))
        created += 1
    return created


def _instructor_totals():
    """Keep the profile counters of the instructors consistent with the rows above."""
    for profile in InstructorProfile.objects.filter(user__email__in=EMAILS).select_related('user'):
        user = profile.user
        earnings = InstructorEarning.objects.filter(instructor=user)
        courses = Course.objects.filter(instructor=user)
        rated = courses.filter(status='published', total_reviews__gt=0)

        profile.earnings_total = earnings.filter(is_paid=True).aggregate(
            total=Sum('final_amount'))['total'] or Decimal('0')
        profile.earnings_pending = earnings.filter(is_paid=False).aggregate(
            total=Sum('final_amount'))['total'] or Decimal('0')
        profile.total_students = Enrollment.objects.filter(course__instructor=user).values(
            'student').distinct().count()
        profile.total_reviews = courses.aggregate(total=Sum('total_reviews'))['total'] or 0
        ratings = [course.average_rating for course in rated]
        profile.average_rating = (sum(ratings) / len(ratings)).quantize(CENTS) if ratings else Decimal('0')
        profile.save()
