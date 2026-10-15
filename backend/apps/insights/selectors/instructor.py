"""Instructor read models: dashboard, earnings and per-course analytics."""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Avg, DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.billing.models import InstructorEarning
from apps.courses.models import Course
from apps.learning.models import Enrollment

MONEY = DecimalField(max_digits=12, decimal_places=2)


def dashboard(instructor):
    """Overview shown on the instructor's home page."""
    courses = Course.objects.filter(instructor=instructor)
    own_enrollments = Enrollment.objects.filter(course__instructor=instructor)

    total_students = own_enrollments.values('student').distinct().count()
    total_revenue = InstructorEarning.objects.filter(
        instructor=instructor
    ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
    avg_rating = courses.aggregate(avg=Avg('average_rating'))['avg'] or Decimal('0')

    recent_enrollments = [
        {
            'student_name': f"{e.student.first_name} {e.student.last_name}",
            'student_email': e.student.email,
            'course_title': e.course.title,
            'enrolled_date': e.enrolled_date.isoformat()
        }
        for e in own_enrollments.select_related('student', 'course').order_by('-enrolled_date')[:10]
    ]

    # revenue of the last 30 days, days without earnings count as 0
    now = timezone.now()
    revenue_by_day = {
        (now - timedelta(days=29 - i)).date().isoformat(): 0 for i in range(30)
    }
    daily = InstructorEarning.objects.filter(
        instructor=instructor,
        created_at__gte=now - timedelta(days=30)
    ).values('created_at__date').annotate(daily_revenue=Sum('final_amount'))
    for row in daily:
        revenue_by_day[row['created_at__date'].isoformat()] = float(row['daily_revenue'])
    revenue_chart = sorted(
        ({'date': day, 'revenue': revenue} for day, revenue in revenue_by_day.items()),
        key=lambda point: point['date']
    )

    top_courses = courses.annotate(
        revenue=Coalesce(Sum('instructorearning__final_amount'), Value(Decimal('0')), output_field=MONEY)
    ).order_by('-revenue', '-total_enrolled')[:3]

    return {
        'stats': {
            'total_courses': courses.count(),
            'total_students': total_students,
            'total_revenue': float(total_revenue),
            'average_rating': float(avg_rating),
            'published_courses': courses.filter(status='published').count(),
            'draft_courses': courses.filter(status='draft').count(),
        },
        'recent_enrollments': recent_enrollments,
        'revenue_chart': revenue_chart,
        'top_courses': [
            {
                'id': str(course.uuid),
                'title': course.title,
                'course_type': course.course_type,
                'total_enrolled': course.total_enrolled,
                'average_rating': float(course.average_rating),
                'total_revenue': float(course.revenue),
                'thumbnail': course.thumbnail.url if course.thumbnail else None
            }
            for course in top_courses
        ],
    }


def earnings(instructor):
    """Earnings summary, monthly chart and the latest earning rows."""
    paid = InstructorEarning.objects.filter(instructor=instructor, is_paid=True)
    pending = InstructorEarning.objects.filter(instructor=instructor, is_paid=False)
    total_earnings = paid.aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
    pending_earnings = pending.aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')

    current_month = timezone.now().date().replace(day=1)
    this_month = InstructorEarning.objects.filter(instructor=instructor, month=current_month)
    monthly_earnings = this_month.aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
    performance = this_month.aggregate(
        total_enrollments=Sum('enrollments_count'),
        total_completions=Sum('completions_count'),
        avg_engagement=Avg('engagement_score')
    )

    # what was earned, newest first: the rows of the calculation, one per course and month
    latest = InstructorEarning.objects.filter(instructor=instructor).select_related('course')
    recent_transactions = [
        {
            'date': earning.created_at.date().isoformat(),
            'course': earning.course.title,
            'student_email': None,   # a share of the pool, not a payment by one student
            'amount': float(earning.final_amount),
            'status': 'Paid' if earning.is_paid else 'Pending',
        }
        for earning in latest.order_by('-month', '-id')[:10]
    ]

    # the last six calendar months, oldest first
    today = timezone.now().date()
    monthly_chart = []
    for back in range(5, -1, -1):
        index = today.year * 12 + today.month - 1 - back
        month_begin = today.replace(year=index // 12, month=index % 12 + 1, day=1)
        month_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            month=month_begin
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
        monthly_chart.append({
            'month': month_begin.strftime('%b'),
            'earnings': float(month_earnings)
        })

    recent_earnings = [
        {
            'id': str(earning.uuid),
            'month': earning.month.strftime('%B %Y'),
            'course': earning.course.title,
            'enrollments': earning.enrollments_count,
            'completions': earning.completions_count,
            'engagement_score': float(earning.engagement_score),
            'amount': float(earning.final_amount),
            'multiplier': float(earning.performance_multiplier),
            'status': 'Paid' if earning.is_paid else 'Pending'
        }
        for earning in InstructorEarning.objects.filter(
            instructor=instructor
        ).select_related('course').order_by('-month')[:12]
    ]

    return {
        'summary': {
            'total_earnings': float(total_earnings),
            'pending_earnings': float(pending_earnings),
            'monthly_earnings': float(monthly_earnings),
            # what the platform keeps of the Plus revenue (the instructors' share is the rest)
            'platform_fee_rate': 100 - settings.INSTRUCTOR_REVENUE_SHARE_PERCENT,
        },
        'recent_transactions': recent_transactions,
        'monthly_chart': monthly_chart,
        'performance': {
            'monthly_enrollments': performance['total_enrollments'] or 0,
            'monthly_completions': performance['total_completions'] or 0,
            'engagement_score': float(performance['avg_engagement'] or 0),
        },
        'recent_earnings': recent_earnings,
        'earnings_model': {
            'description': f'{settings.INSTRUCTOR_REVENUE_SHARE_PERCENT}% of what students pay for Coursera '
                           'Plus each month is shared among the Plus courses by their enrollments, '
                           'completions and engagement',
            'factors': [
                'Number of enrollments in Coursera Plus courses',
                'Course completion rate',
                'Total watch time',
                'Student engagement score'
            ]
        }
    }


def course_analytics(course):
    """Learner and revenue figures of one course."""
    enrollments = Enrollment.objects.filter(course=course)
    total_students = enrollments.count()
    active_students = enrollments.filter(
        last_accessed__gte=timezone.now() - timedelta(days=7)
    ).count()

    completion_rate = 0
    if total_students > 0:
        completed = enrollments.filter(status='completed').count()
        completion_rate = (completed / total_students) * 100

    avg_progress = enrollments.aggregate(Avg('progress_percentage'))['progress_percentage__avg'] or 0
    total_revenue = InstructorEarning.objects.filter(
        course=course
    ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0

    return {
        'total_students': total_students,
        'active_students': active_students,
        'completion_rate': float(completion_rate),
        'average_progress': float(avg_progress),
        'total_revenue': float(total_revenue),
        'average_rating': float(course.average_rating),
        'total_reviews': course.total_reviews,
        # reviews are not implemented; the key is kept for API compatibility
        'recent_reviews': []
    }
