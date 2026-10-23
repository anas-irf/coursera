"""Instructor analytics: how the instructor's courses are learned, graded and paid, month by month.

Every figure is counted from the rows the other slices keep (enrolments, quiz attempts, hand-ins,
earning rows); a rate or an average with nothing to average is ``None``, never a made-up zero.
"""
import calendar
from datetime import timedelta

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.assessments.models import AssignmentSubmission, QuizAttempt
from apps.billing.models import InstructorEarning
from apps.courses.models import Course
from apps.learning import selectors as learning
from apps.learning.models import Enrollment

PERIODS = (3, 6, 12)            # months the analytics page may ask for
ACTIVE_DAYS = 7                 # a learner who opened the course this recently is "active"
HALF = 50                       # progress (percent) that splits "under half" from "half or more"


def percent(part, whole):
    """``part`` of ``whole`` in percent with one decimal; ``None`` when there is no whole."""
    return round(part * 100 / whole, 1) if whole else None


def mean(value):
    """An aggregate's average with one decimal; ``None`` when there was nothing to average."""
    return round(float(value), 1) if value is not None else None


def money(value):
    """A sum of money as a JSON number of dollars (``0.0`` for an empty sum)."""
    return round(float(value or 0), 2)


def month_starts(months, *, today=None):
    """The first days of the last ``months`` calendar months, the current one included, oldest first."""
    today = today or timezone.localdate()
    return [learning.month_start(today, back=months - 1 - index) for index in range(months)]


def month_row(start, **figures):
    """One point of a monthly chart: ``{"month": "2026-05", "label": "May", ...figures}``."""
    return {'month': start.strftime('%Y-%m'), 'label': calendar.month_abbr[start.month], **figures}


def by_month(queryset, field, *, value=None):
    """``{first day of the month: count (or the sum of value)}`` of the rows of ``queryset`` by ``field``."""
    rows = (queryset.annotate(bucket=TruncMonth(field)).values('bucket')
            .annotate(total=Sum(value) if value else Count('pk')).order_by())
    return {_day(row['bucket']): row['total'] for row in rows if row['bucket'] is not None}


def _day(moment):
    """A truncated month as a ``date`` (``TruncMonth`` of a date-time answers a date-time)."""
    return timezone.localtime(moment).date() if hasattr(moment, 'hour') else moment


def _rating(courses):
    rated = courses.filter(total_reviews__gt=0).aggregate(average=Avg('average_rating'))['average']
    return mean(rated)


def instructor_analytics(instructor, months=6, *, now=None):
    """The analytics page of ``instructor`` over the last ``months`` calendar months."""
    now = now or timezone.now()
    active_since = now - timedelta(days=ACTIVE_DAYS)

    courses = Course.objects.filter(instructor=instructor)
    enrollments = Enrollment.objects.filter(course__instructor=instructor)
    attempts = QuizAttempt.objects.filter(quiz__course__instructor=instructor, end_time__isnull=False)
    submissions = AssignmentSubmission.objects.filter(assignment__course__instructor=instructor)
    earnings = InstructorEarning.objects.filter(instructor=instructor)

    counts = enrollments.aggregate(
        total=Count('pk'),
        completed=Count('pk', filter=Q(status='completed')),
        progress=Avg('progress_percentage'),
        not_started=Count('pk', filter=Q(progress_percentage__lte=0) & ~Q(status='completed')),
        under_half=Count('pk', filter=Q(progress_percentage__gt=0, progress_percentage__lt=HALF)
                         & ~Q(status='completed')),
        over_half=Count('pk', filter=Q(progress_percentage__gte=HALF) & ~Q(status='completed')),
    )
    quiz = attempts.aggregate(total=Count('pk'), passed=Count('pk', filter=Q(passed=True)), score=Avg('score'))

    totals = {
        'courses': courses.count(),
        'published_courses': courses.filter(status='published').count(),
        'students': enrollments.values('student').distinct().count(),
        'enrollments': counts['total'],
        'active_learners': enrollments.filter(last_accessed__gte=active_since).values('student').distinct().count(),
        'completions': counts['completed'],
        'completion_rate': percent(counts['completed'], counts['total']),
        'average_progress': mean(counts['progress']),
        'quiz_attempts': quiz['total'],
        'average_quiz_score': mean(quiz['score']),
        'quiz_pass_rate': percent(quiz['passed'], quiz['total']),
        'submissions': submissions.count(),
        'pending_submissions': submissions.filter(grade__isnull=True).count(),
        'earnings': money(earnings.aggregate(total=Sum('final_amount'))['total']),
        'average_rating': _rating(courses),
    }

    starts = month_starts(months, today=timezone.localdate(now))
    first = starts[0]
    enrolled = by_month(enrollments.filter(enrolled_date__date__gte=first), 'enrolled_date')
    completed = by_month(enrollments.filter(completed_date__date__gte=first), 'completed_date')
    earned = {row['month']: row['total'] for row in
              earnings.filter(month__gte=first).values('month').annotate(total=Sum('final_amount')).order_by()}
    monthly = [
        month_row(start, enrollments=enrolled.get(start, 0), completions=completed.get(start, 0),
                  earnings=money(earned.get(start)))
        for start in starts
    ]

    distribution = [
        {'key': 'not_started', 'label': 'Not started', 'count': counts['not_started']},
        {'key': 'under_half', 'label': 'Under half', 'count': counts['under_half']},
        {'key': 'over_half', 'label': 'Half or more', 'count': counts['over_half']},
        {'key': 'completed', 'label': 'Completed', 'count': counts['completed']},
    ]

    return {
        'months': months,
        'totals': totals,
        'monthly': monthly,
        'progress_distribution': distribution,
        'courses': course_rows(courses, attempts, earnings, active_since),
    }


def course_rows(courses, attempts, earnings, active_since):
    """One row per course: learners, completion, progress, quiz scores, rating and revenue."""
    revenue = {row['course']: row['total'] for row in
               earnings.values('course').annotate(total=Sum('final_amount')).order_by()}
    quiz_scores = {row['quiz__course']: row['score'] for row in
                   attempts.values('quiz__course').annotate(score=Avg('score')).order_by()}
    annotated = courses.annotate(
        n_enrollments=Count('enrollments', distinct=True),
        n_completions=Count('enrollments', filter=Q(enrollments__status='completed'), distinct=True),
        n_active=Count('enrollments__student', filter=Q(enrollments__last_accessed__gte=active_since),
                       distinct=True),
        progress=Avg('enrollments__progress_percentage'),
    ).order_by('-n_enrollments', 'title', 'id')

    return [
        {
            'id': str(course.uuid),
            'title': course.title,
            'status': course.status,
            'course_type': course.course_type,
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'enrollments': course.n_enrollments,
            'active_learners': course.n_active,
            'completions': course.n_completions,
            'completion_rate': percent(course.n_completions, course.n_enrollments),
            'average_progress': mean(course.progress),
            'average_quiz_score': mean(quiz_scores.get(course.pk)),
            'average_rating': round(float(course.average_rating), 1) if course.total_reviews else None,
            'total_reviews': course.total_reviews,
            'revenue': money(revenue.get(course.pk)),
        }
        for course in annotated
    ]
