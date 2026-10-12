"""Student read models: statistics, weekly chart and achievements."""
import calendar
from datetime import timedelta

from django.db.models import Avg
from django.utils import timezone

from apps.accounts.models import StudentProfile, User
from apps.assessments.models import QuizAttempt
from apps.billing.selectors import has_plus_access
from apps.learning.models import Enrollment, LectureProgress

POINTS_PER_LEVEL = 250
POINTS_PER_COMPLETED_COURSE = 100
POINTS_PER_LESSON = 5
POINTS_PER_PASSED_QUIZ = 25


def stats(student):
    """Headline numbers of a student's learning."""
    enrollments = Enrollment.objects.filter(student=student)
    active = enrollments.filter(status='active')
    completed = enrollments.filter(status='completed')

    total_progress = 0
    if enrollments.exists():
        total_progress = enrollments.aggregate(
            avg_progress=Avg('progress_percentage')
        )['avg_progress'] or 0

    profile = getattr(student, 'student_profile', None)

    return {
        'courses_enrolled': enrollments.count(),
        'courses_active': active.count(),
        'courses_completed': completed.count(),
        'certificates_earned': completed.filter(certificate_issued=True).count(),
        'total_progress': round(total_progress, 1),
        'has_plus_subscription': has_plus_access(student),
        'learning_streak': getattr(profile, 'learning_streak', 0) if profile else 0,
        'total_learning_hours': float(getattr(profile, 'total_learning_hours', 0)) if profile else 0,
    }


def weekly_progress():
    """PLACEHOLDER: a fixed four-month series.

    Nothing records watch time yet (``LectureProgress.progress_seconds`` is never
    written), so there is no real data to chart.
    """
    today = timezone.now().date()
    mock_hours = [25, 32, 28, 42]

    months = []
    for i in range(4):
        month_date = today.replace(day=1) - timedelta(days=i * 30)
        months.append({'month': calendar.month_abbr[month_date.month], 'hours': mock_hours[i]})

    months.reverse()  # chronological order
    return {'monthly_progress': months}


# --------------------------------------------------------------------------- #
# achievements
# --------------------------------------------------------------------------- #
def learning_streak(student, days=30):
    """Consecutive days with learning activity, counting back from today."""
    today = timezone.now().date()
    streak = 0

    for i in range(days):
        day = today - timedelta(days=i)
        active = LectureProgress.objects.filter(
            enrollment__student=student,
            updated_at__date=day
        ).exists()

        if active:
            streak += 1
        elif i > 0:  # no activity yet today does not break the streak
            break

    return streak


def total_points(student):
    """Gamification points: courses, lessons and passed quizzes."""
    completed_courses = Enrollment.objects.filter(student=student, status='completed').count()
    lessons = LectureProgress.objects.filter(enrollment__student=student, is_completed=True).count()
    quizzes = QuizAttempt.objects.filter(student=student, passed=True).count()

    return (completed_courses * POINTS_PER_COMPLETED_COURSE
            + lessons * POINTS_PER_LESSON
            + quizzes * POINTS_PER_PASSED_QUIZ)


def badges(student):
    """The achievement list (some entries are not computed yet and stay unearned)."""
    lessons = LectureProgress.objects.filter(enrollment__student=student, is_completed=True)
    lessons_completed = lessons.count()
    streak = learning_streak(student)
    perfect_quizzes = QuizAttempt.objects.filter(student=student, score__gte=100).count()

    items = [
        {
            'id': 1,
            'title': 'First Steps',
            'description': 'Complete your first lesson',
            'icon': '👶',
            'earned': lessons_completed > 0,
            'date': None,
            'progress': 100 if lessons_completed > 0 else 0
        },
        {
            'id': 2,
            'title': 'Dedicated Learner',
            'description': 'Complete 10 lessons',
            'icon': '📚',
            'earned': False,
            'progress': min(100, lessons_completed * 10)
        },
        {
            'id': 3,
            'title': 'Week Warrior',
            'description': '7 day learning streak',
            'icon': '🔥',
            'earned': streak >= 7,
            'progress': min(100, streak * 100 / 7)
        },
        {
            'id': 4,
            'title': 'Quiz Master',
            'description': 'Score 100% on 5 quizzes',
            'icon': '🏆',
            'earned': False,
            'progress': min(100, perfect_quizzes * 20)
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

    for item in items:
        if item['earned']:
            item['date'] = timezone.now().date().isoformat()
    return items


def achievements(student):
    """Points, level, rank and the badge list of one student."""
    profile, _ = StudentProfile.objects.get_or_create(user=student)

    points = total_points(student)
    level = points // POINTS_PER_LEVEL

    global_rank = User.objects.filter(
        user_type='student',
        student_profile__total_learning_hours__gt=profile.total_learning_hours
    ).count() + 1

    return {
        'total_points': points,
        'current_level': level,
        'next_level_points': (level + 1) * POINTS_PER_LEVEL,
        'global_rank': global_rank,
        'monthly_rank': 50,  # simplified: not computed yet
        'achievements': badges(student),
    }
