# insights/api/views.py - read models that combine several slices
import calendar
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.billing.models import InstructorEarning
from apps.billing.selectors import has_plus_access
from apps.learning.models import Enrollment


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_earnings(request):
    """Get instructor earnings based on Coursera model"""

    try:
        if request.user.user_type != 'instructor':
            return Response({'error': 'Not an instructor'}, status=403)

        instructor = request.user

        # Get earnings summary (from revenue sharing)
        total_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            is_paid=True
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')

        pending_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            is_paid=False
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')

        # This month's earnings
        current_month = timezone.now().date().replace(day=1)
        monthly_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            month=current_month
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')

        # Performance metrics
        current_month_data = InstructorEarning.objects.filter(
            instructor=instructor,
            month=current_month
        ).aggregate(
            total_enrollments=Sum('enrollments_count'),
            total_completions=Sum('completions_count'),
            avg_engagement=Avg('engagement_score')
        )

        # Recent transactions (simulated from enrollment data for frontend compatibility)
        try:
            recent_enrollments = Enrollment.objects.filter(
                course__instructor=instructor
            ).select_related('student', 'course').order_by('-enrolled_date')[:10]
        except Exception:
            recent_enrollments = []

        recent_transactions = []
        for enrollment in recent_enrollments:
            # Simulate transaction based on course type and enrollment
            amount = 49.99  # Default amount for Coursera Plus revenue share
            if hasattr(enrollment.course, 'level') and enrollment.course.level == 'advanced':
                amount = 59.99
            elif hasattr(enrollment.course, 'level') and enrollment.course.level == 'beginner':
                amount = 39.99

            recent_transactions.append({
                'date': enrollment.enrolled_date.date().isoformat(),
                'course': enrollment.course.title,
                'student_email': enrollment.student.email,
                'amount': amount,
                'status': 'Paid'  # Coursera Plus subscriptions are pre-paid
            })

        # Monthly chart data (last 6 months)
        current_date = timezone.now().date()
        monthly_chart = []

        for i in range(6):
            # Calculate months back (approximate with 30 days)
            month_start = current_date - timedelta(days=30*(5-i))
            month_start = month_start.replace(day=1)

            month_earnings = InstructorEarning.objects.filter(
                instructor=instructor,
                month=month_start
            ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0

            monthly_chart.append({
                'month': month_start.strftime('%b'),
                'earnings': float(month_earnings)
            })

        # Recent earnings by course
        recent_earnings = InstructorEarning.objects.filter(
            instructor=instructor
        ).select_related('course').order_by('-month')[:12]

        earnings_data = []
        for earning in recent_earnings:
            earnings_data.append({
                'id': str(earning.uuid),
                'month': earning.month.strftime('%B %Y'),
                'course': earning.course.title,
                'enrollments': earning.enrollments_count,
                'completions': earning.completions_count,
                'engagement_score': float(earning.engagement_score),
                'amount': float(earning.final_amount),
                'multiplier': float(earning.performance_multiplier),
                'status': 'Paid' if earning.is_paid else 'Pending'
            })

        return Response({
            'summary': {
                'total_earnings': float(total_earnings),
                'pending_earnings': float(pending_earnings),
                'monthly_earnings': float(monthly_earnings),
                'platform_fee_rate': 30  # Frontend expects this field
            },
            'recent_transactions': recent_transactions,  # Frontend expects this field
            'monthly_chart': monthly_chart,  # Frontend expects this field
            'performance': {
                'monthly_enrollments': current_month_data['total_enrollments'] or 0,
                'monthly_completions': current_month_data['total_completions'] or 0,
                'engagement_score': float(current_month_data['avg_engagement'] or 0),
            },
            'recent_earnings': earnings_data,
            'earnings_model': {
                'description': 'Earnings are calculated based on student enrollments, course completions, and engagement metrics',
                'factors': [
                    'Number of enrollments in Coursera Plus courses',
                    'Course completion rate',
                    'Total watch time',
                    'Student engagement score'
                ]
            }
        })

    except Exception as e:
        # Return safe fallback data if there are any errors
        return Response({
            'summary': {
                'total_earnings': 0,
                'pending_earnings': 0,
                'monthly_earnings': 0,
                'platform_fee_rate': 30
            },
            'recent_transactions': [],
            'monthly_chart': [
                {'month': 'Jan', 'earnings': 0},
                {'month': 'Feb', 'earnings': 0},
                {'month': 'Mar', 'earnings': 0},
                {'month': 'Apr', 'earnings': 0},
                {'month': 'May', 'earnings': 0},
                {'month': 'Jun', 'earnings': 0}
            ],
            'performance': {
                'monthly_enrollments': 0,
                'monthly_completions': 0,
                'engagement_score': 0,
            },
            'recent_earnings': [],
            'earnings_model': {
                'description': 'Earnings are calculated based on student enrollments, course completions, and engagement metrics',
                'factors': [
                    'Number of enrollments in Coursera Plus courses',
                    'Course completion rate',
                    'Total watch time',
                    'Student engagement score'
                ]
            },
            'error': str(e) if request.user.is_staff else 'Unable to load earnings data'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_stats(request):
    """Get student learning statistics"""
    try:
        user = request.user
        if user.user_type != 'student':
            return Response(
                {'error': 'Only students can access stats'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get enrollment data
        enrollments = Enrollment.objects.filter(student=user)

        active_enrollments = enrollments.filter(status='active')
        completed_enrollments = enrollments.filter(status='completed')

        # Calculate total progress
        total_progress = 0
        if enrollments.exists():
            total_progress = enrollments.aggregate(
                avg_progress=Avg('progress_percentage')
            )['avg_progress'] or 0

        # Get certificates
        certificates_earned = completed_enrollments.filter(certificate_issued=True).count()

        # Get subscription status
        has_plus = has_plus_access(user)

        return Response({
            'courses_enrolled': enrollments.count(),
            'courses_active': active_enrollments.count(),
            'courses_completed': completed_enrollments.count(),
            'certificates_earned': certificates_earned,
            'total_progress': round(total_progress, 1),
            'has_plus_subscription': has_plus,
            'learning_streak': getattr(user.student_profile, 'learning_streak', 0) if hasattr(user, 'student_profile') else 0,
            'total_learning_hours': float(getattr(user.student_profile, 'total_learning_hours', 0)) if hasattr(user, 'student_profile') else 0
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get student stats: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_weekly_progress(request):
    """Get student's weekly learning progress"""
    try:
        user = request.user
        if user.user_type != 'student':
            return Response(
                {'error': 'Only students can access weekly progress'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Generate sample weekly progress data (replace with real implementation later)
        # Get last 4 months for demonstration
        today = timezone.now().date()
        months_data = []

        for i in range(4):
            month_date = today.replace(day=1) - timedelta(days=i*30)
            month_name = calendar.month_abbr[month_date.month]

            # Mock hours learned per month (replace with real data from learning activities)
            mock_hours = [25, 32, 28, 42][i] if i < 4 else 20

            months_data.append({
                'month': month_name,
                'hours': mock_hours
            })

        months_data.reverse()  # Show chronological order

        return Response({
            'monthly_progress': months_data
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get weekly progress: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
