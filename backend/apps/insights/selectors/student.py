"""Student read models: statistics, hours per month and achievements.

Everything is derived from what the student did: the learning log (the ``learning`` slice)
for time, streaks and ranks, and completed lectures, quiz attempts and finished courses for
the rest.  Nothing here is a placeholder, and nothing is written by a read.
"""
import calendar
from datetime import timedelta

from django.db.models import Avg
from django.utils import timezone

from apps.assessments.models import QuizAttempt
from apps.billing.selectors import has_plus_access
from apps.learning import selectors as learning
from apps.learning.models import Enrollment, LectureProgress

POINTS_PER_LEVEL = 250
POINTS_PER_COMPLETED_COURSE = 100
POINTS_PER_LESSON = 5
POINTS_PER_PASSED_QUIZ = 25

MONTHS_CHARTED = 4
WEEK_STREAK = 7
LESSONS_FOR_DEDICATED = 10
PERFECT_QUIZZES = 5
SPEED_DAYS = 7
POLYGLOT_CATEGORIES = 3


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

    return {
        'courses_enrolled': enrollments.count(),
        'courses_active': active.count(),
        'courses_completed': completed.count(),
        'certificates_earned': completed.filter(certificate_issued=True).count(),
        'total_progress': round(total_progress, 1),
        'has_plus_subscription': has_plus_access(student),
        'learning_streak': learning.current_streak(student),
        'total_learning_hours': round(learning.total_seconds(student) / 3600, 2),
    }


def weekly_progress(student):
    """Hours learned in each of the last months, oldest first (zeros where nothing was recorded).

    The endpoint and its key keep their historic names ("weekly", ``monthly_progress``).
    """
    return {
        'monthly_progress': [
            {'month': calendar.month_abbr[first.month], 'hours': round(seconds / 3600, 1)}
            for first, seconds in learning.seconds_by_month(student, MONTHS_CHARTED)
        ]
    }


# --------------------------------------------------------------------------- #
# achievements
# --------------------------------------------------------------------------- #
def total_points(student):
    """Gamification points: courses, lessons and passed quizzes."""
    completed_courses = Enrollment.objects.filter(student=student, status='completed').count()
    lessons = LectureProgress.objects.filter(enrollment__student=student, is_completed=True).count()
    quizzes = QuizAttempt.objects.filter(student=student, passed=True).count()

    return (completed_courses * POINTS_PER_COMPLETED_COURSE
            + lessons * POINTS_PER_LESSON
            + quizzes * POINTS_PER_PASSED_QUIZ)


def _day(moment):
    return timezone.localdate(moment).isoformat() if moment else None


def _nth(moments, count):
    """The moment of the ``count``-th event (1-based), ``None`` while it has not happened."""
    return moments[count - 1] if len(moments) >= count else None


def _badge(number, title, description, icon, progress, earned_on=None):
    earned = progress >= 100
    return {
        'id': number,
        'title': title,
        'description': description,
        'icon': icon,
        'earned': earned,
        'date': _day(earned_on) if earned else None,
        'progress': progress,
    }


def badges(student):
    """The achievement list: progress towards each badge and, once earned, the day it was."""
    lessons = LectureProgress.objects.filter(enrollment__student=student, is_completed=True)
    lessons_completed = lessons.count()
    lesson_moments = list(
        lessons.exclude(completed_date=None).order_by('completed_date')
        .values_list('completed_date', flat=True)
    )
    perfect_moments = list(
        QuizAttempt.objects.filter(student=student, score__gte=100, end_time__isnull=False)
        .order_by('end_time').values_list('end_time', flat=True)
    )
    finished = list(
        Enrollment.objects.filter(student=student, status='completed', completed_date__isnull=False)
        .select_related('course').order_by('completed_date')
    )

    streak, last_day = learning.streak_run(student)
    week_reached = last_day - timedelta(days=streak - WEEK_STREAK) if streak >= WEEK_STREAK else None

    quick = next((e for e in finished
                  if e.completed_date - e.enrolled_date <= timedelta(days=SPEED_DAYS)), None)

    categories, polyglot_on = set(), None
    for enrollment in finished:
        if enrollment.course.category_id:
            categories.add(enrollment.course.category_id)
        if polyglot_on is None and len(categories) >= POLYGLOT_CATEGORIES:
            polyglot_on = enrollment.completed_date

    return [
        _badge(1, 'First Steps', 'Complete your first lesson', '👶',
               100 if lessons_completed else 0, _nth(lesson_moments, 1)),
        _badge(2, 'Dedicated Learner', f'Complete {LESSONS_FOR_DEDICATED} lessons', '📚',
               min(100, lessons_completed * 100 // LESSONS_FOR_DEDICATED),
               _nth(lesson_moments, LESSONS_FOR_DEDICATED)),
        {
            **_badge(3, 'Week Warrior', f'{WEEK_STREAK} day learning streak', '🔥',
                     min(100, streak * 100 / WEEK_STREAK)),
            # the day the run reached its seventh day
            'date': week_reached.isoformat() if week_reached else None,
        },
        _badge(4, 'Quiz Master', f'Score 100% on {PERFECT_QUIZZES} quizzes', '🏆',
               min(100, len(perfect_moments) * 100 // PERFECT_QUIZZES),
               _nth(perfect_moments, PERFECT_QUIZZES)),
        _badge(5, 'Speed Learner', f'Complete a course in {SPEED_DAYS} days', '⚡',
               100 if quick else 0, quick.completed_date if quick else None),
        _badge(6, 'Polyglot', f'Complete courses in {POLYGLOT_CATEGORIES} different categories', '🌍',
               min(100, len(categories) * 100 // POLYGLOT_CATEGORIES), polyglot_on),
    ]


def achievements(student):
    """Points, level, rank and the badge list of one student."""
    points = total_points(student)
    level = points // POINTS_PER_LEVEL

    month = learning.month_start(timezone.localdate())
    this_month = learning.total_seconds(student, since=month)

    return {
        'total_points': points,
        'current_level': level,
        'next_level_points': (level + 1) * POINTS_PER_LEVEL,
        'global_rank': learning.rank_by_seconds(student),
        # nobody ranks in a month they did not learn in
        'monthly_rank': learning.rank_by_seconds(student, since=month) if this_month else None,
        'achievements': badges(student),
    }
