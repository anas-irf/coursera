# courses/student_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta

from apps.accounts.permissions import IsStudent

from apps.learning.models import Enrollment, LectureProgress
from apps.certificates.models import Certificate
from apps.accounts.models import User, StudentProfile
from apps.assessments.models import QuizAttempt


@api_view(['GET'])
@permission_classes([IsStudent])
def student_certificates(request):
    """Get student's earned certificates"""
    
    certificates = Certificate.objects.filter(
        student=request.user
    ).select_related('course', 'enrollment')
    
    cert_data = []
    for cert in certificates:
        cert_data.append({
            'id': str(cert.uuid),
            'course_title': cert.course.title,
            'instructor': f"{cert.course.instructor.first_name} {cert.course.instructor.last_name}",
            'issue_date': cert.issue_date.isoformat(),
            'certificate_id': cert.certificate_number,
            'verification_url': f"https://coursera.com/verify/{cert.verification_code}",
            'grade': float(cert.final_grade) if cert.final_grade else None,
            'thumbnail': cert.course.thumbnail.url if cert.course.thumbnail else None
        })
    
    return Response(cert_data)

@api_view(['GET'])
@permission_classes([IsStudent])
def student_achievements(request):
    """Get student achievements and gamification data"""
    
    student = request.user
    profile, _ = StudentProfile.objects.get_or_create(user=student)
    
    # Calculate points and level
    total_points = calculate_total_points(student)
    current_level = total_points // 250  # 250 points per level
    next_level_points = (current_level + 1) * 250
    
    # Calculate ranks (simplified)
    global_rank = User.objects.filter(
        user_type='student',
        student_profile__total_learning_hours__gt=profile.total_learning_hours
    ).count() + 1
    
    # Monthly rank
    month_start = timezone.now().replace(day=1)
    monthly_rank = 50  # Simplified
    
    # Get all achievements
    achievements = get_all_achievements(student)
    
    return Response({
        'total_points': total_points,
        'current_level': current_level,
        'next_level_points': next_level_points,
        'global_rank': global_rank,
        'monthly_rank': monthly_rank,
        'achievements': achievements
    })

# Helper Functions
def calculate_learning_streak(student):
    """Calculate current learning streak"""
    today = timezone.now().date()
    streak = 0
    
    for i in range(30):  # Check last 30 days
        check_date = today - timedelta(days=i)
        has_activity = LectureProgress.objects.filter(
            enrollment__student=student,
            updated_at__date=check_date
        ).exists()
        
        if has_activity:
            streak += 1
        elif i > 0:  # Don't break on today if no activity yet
            break
    
    return streak


def calculate_total_points(student):
    """Calculate total points for gamification"""
    points = 0
    
    # Points for completed courses (100 each)
    completed = Enrollment.objects.filter(
        student=student,
        status='completed'
    ).count()
    points += completed * 100
    
    # Points for lessons (5 each)
    lessons = LectureProgress.objects.filter(
        enrollment__student=student,
        is_completed=True
    ).count()
    points += lessons * 5
    
    # Points for quizzes (10-50 based on score)
    quizzes = QuizAttempt.objects.filter(
        student=student,
        passed=True
    ).count()
    points += quizzes * 25
    
    return points

def get_all_achievements(student):
    """Get comprehensive list of achievements"""
    
    achievements = [
        {
            'id': 1,
            'title': 'First Steps',
            'description': 'Complete your first lesson',
            'icon': '👶',
            'earned': LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).exists(),
            'date': None,
            'progress': 100 if LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).exists() else 0
        },
        {
            'id': 2,
            'title': 'Dedicated Learner',
            'description': 'Complete 10 lessons',
            'icon': '📚',
            'earned': False,
            'progress': min(100, LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).count() * 10)
        },
        {
            'id': 3,
            'title': 'Week Warrior',
            'description': '7 day learning streak',
            'icon': '🔥',
            'earned': calculate_learning_streak(student) >= 7,
            'progress': min(100, calculate_learning_streak(student) * 100 / 7)
        },
        {
            'id': 4,
            'title': 'Quiz Master',
            'description': 'Score 100% on 5 quizzes',
            'icon': '🏆',
            'earned': False,
            'progress': min(100, QuizAttempt.objects.filter(
                student=student,
                score__gte=100
            ).count() * 20)
        },
        {
            'id': 5,
            'title': 'Speed Learner',
            'description': 'Complete a course in 7 days',
            'icon': '⚡',
            'earned': False,
            'progress': 0
        },
        {
            'id': 6,
            'title': 'Polyglot',
            'description': 'Complete courses in 3 different categories',
            'icon': '🌍',
            'earned': False,
            'progress': 0
        }
    ]
    
    # Set earned dates
    for achievement in achievements:
        if achievement['earned']:
            achievement['date'] = timezone.now().date().isoformat()
    
    return achievements


