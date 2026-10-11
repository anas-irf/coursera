# courses/views.py
#
# What is left here is served from the courses URLs for historical reasons and
# moves to its own slice later: the instructor dashboard and admin user list
# (insights) and assignment grading / gradebooks (assessments).
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsInstructor
from apps.billing.models import InstructorEarning
from apps.learning.models import Enrollment

from .models import Course


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_dashboard(request):
    """Get dashboard overview stats for instructor"""
    try:
        instructor = request.user
        
        # Get all instructor's courses
        courses = Course.objects.filter(instructor=instructor)
        
        # Calculate stats
        total_students = Enrollment.objects.filter(
            course__instructor=instructor
        ).values('student').distinct().count()
        
        total_revenue = InstructorEarning.objects.filter(
            instructor=instructor
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
        
        avg_rating = courses.aggregate(
            avg=Avg('average_rating')
        )['avg'] or Decimal('0')
        
        # Recent enrollments (last 10)
        recent_enrollments = Enrollment.objects.filter(
            course__instructor=instructor
        ).select_related('student', 'course').order_by('-enrolled_date')[:10]
        
        recent_enrollments_data = [
            {
                'student_name': f"{e.student.first_name} {e.student.last_name}",
                'student_email': e.student.email,
                'course_title': e.course.title,
                'enrolled_date': e.enrolled_date.isoformat()
            }
            for e in recent_enrollments
        ]
        
        # Revenue chart data (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        revenue_by_day = {}
        
        earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            created_at__gte=thirty_days_ago
        ).values('created_at__date').annotate(
            daily_revenue=Sum('final_amount')
        )
        
        # Fill in missing days with 0
        for i in range(30):
            date = (timezone.now() - timedelta(days=29-i)).date()
            revenue_by_day[date.isoformat()] = 0
        
        for earning in earnings:
            date_str = earning['created_at__date'].isoformat()
            revenue_by_day[date_str] = float(earning['daily_revenue'])
        
        revenue_chart = [
            {'date': date, 'revenue': revenue}
            for date, revenue in revenue_by_day.items()
        ]
        revenue_chart.sort(key=lambda x: x['date'])
        
        # Top performing courses
        top_courses_qs = courses.annotate(
            total_revenue=Sum('earnings__final_amount')
        ).order_by('-total_revenue')[:3]
        
        top_courses_data = []
        for course in top_courses_qs:
            revenue = InstructorEarning.objects.filter(
                course=course
            ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
            
            top_courses_data.append({
                'id': str(course.uuid),
                'title': course.title,
                'course_type': course.course_type,  # Add course_type
                'total_enrolled': course.total_enrolled,
                'average_rating': float(course.average_rating),
                'total_revenue': float(revenue),
                'thumbnail': course.thumbnail.url if course.thumbnail else None
            })
        
        return Response({
            'stats': {
                'total_courses': courses.count(),
                'total_students': total_students,
                'total_revenue': float(total_revenue),
                'average_rating': float(avg_rating),
                'published_courses': courses.filter(status='published').count(),
                'draft_courses': courses.filter(status='draft').count(),
            },
            'recent_enrollments': recent_enrollments_data,
            'revenue_chart': revenue_chart,
            'top_courses': top_courses_data
        })
        
    except Exception as e:
        # Return safe fallback data
        return Response({
            'stats': {
                'total_courses': 0,
                'total_students': 0,
                'total_revenue': 0,
                'average_rating': 0,
                'published_courses': 0,
                'draft_courses': 0,
            },
            'recent_enrollments': [],
            'revenue_chart': [],
            'top_courses': [],
            'error': str(e) if request.user.is_staff else 'Unable to load dashboard data'
        })


# Section and Lecture ViewSets


# Admin API endpoints


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_users(request):
    """Get all users for admin dashboard"""
    try:
        from apps.accounts.models import User

        users = User.objects.all().order_by('-date_joined')
        data = []

        for user in users:
            try:
                # Basic user data
                user_data = {
                    'id': str(user.uuid),
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split('@')[0],
                    'email': user.email,
                    'user_type': user.user_type,
                    'join_date': user.date_joined.isoformat(),
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'is_active': user.is_active,
                    'status': 'active' if user.is_active else 'inactive',
                    'phone_number': getattr(user, 'phone_number', '') or '',
                    'email_verified': getattr(user, 'email_verified', False),
                    'avatar': f'https://ui-avatars.com/api/?name={user.first_name or "User"}&background=6366F1&color=fff'
                }

                # Add user-type specific data
                if user.user_type == 'student':
                    from apps.learning.models import Enrollment
                    enrollments = Enrollment.objects.filter(student=user)
                    user_data.update({
                        'courses_enrolled': enrollments.count(),
                        'completed_courses': enrollments.filter(status='completed').count(),
                        'active_courses': enrollments.filter(status='active').count(),
                    })

                elif user.user_type == 'instructor':
                    from apps.courses.models import Course
                    from apps.learning.models import Enrollment
                    instructor_courses = Course.objects.filter(instructor=user)
                    user_data.update({
                        'courses_created': instructor_courses.count(),
                        'published_courses': instructor_courses.filter(status='published').count(),
                        'draft_courses': instructor_courses.filter(status='draft').count(),
                        'students_taught': Enrollment.objects.filter(course__instructor=user).values('student').distinct().count(),
                    })

                else:  # admin users
                    user_data.update({
                        'is_superuser': getattr(user, 'is_superuser', False),
                        'is_admin': getattr(user, 'is_admin', False),
                    })

                data.append(user_data)

            except Exception as user_error:
                # Skip users that cause errors but continue processing others
                continue

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get users: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Assignment Management for Instructors


