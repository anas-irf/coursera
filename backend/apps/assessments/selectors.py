"""Read side of assessments."""
from decimal import Decimal

from django.db.models import Count, Q, Sum

from apps.learning import selectors as learning

from .models import Assignment, AssignmentSubmission, Quiz


def instructor_assignments(instructor):
    """Active assignments of the instructor's courses with submission counters."""
    return (
        Assignment.objects
        .filter(course__instructor=instructor, is_active=True)
        .select_related('course', 'lecture')
        .annotate(
            submission_count=Count('submissions'),
            graded_count=Count('submissions', filter=Q(submissions__grade__isnull=False)),
        )
    )


def assignment_submissions(assignment):
    """Submissions of one assignment, newest first."""
    return (
        AssignmentSubmission.objects
        .filter(assignment=assignment)
        .select_related('student', 'graded_by')
        .order_by('-submitted_at')
    )


def active_enrollments(course):
    """Learners that are graded in the course."""
    return learning.course_enrollments(course)


# --------------------------------------------------------------------------- #
# what a lecture holds
# --------------------------------------------------------------------------- #
def quiz_of(lecture):
    """The quiz of a quiz lecture (``None`` while it has none)."""
    return Quiz.objects.filter(lecture=lecture).prefetch_related('questions__options').first()


def assignment_of(lecture):
    """The assignment of an assignment lecture (``None`` while it has none)."""
    return Assignment.objects.filter(lecture=lecture).first()


def submission_of(student, assignment):
    """The student's hand-in of ``assignment`` (``None`` when they have not handed in)."""
    return AssignmentSubmission.objects.filter(assignment=assignment, student=student).first()


def quiz_weight(course):
    """Share of the final grade the course's quizzes carry (all of them, active or not)."""
    return Quiz.objects.filter(course=course).aggregate(total=Sum('weight'))['total'] or Decimal('0')


def assignment_weight(course):
    """Share of the final grade the course's assignments carry."""
    return Assignment.objects.filter(course=course).aggregate(total=Sum('weight'))['total'] or Decimal('0')


def awaiting_grade(student, course):
    """Whether a hand-in that counts towards the course grade has not been graded yet."""
    return AssignmentSubmission.objects.filter(
        student=student,
        assignment__course=course,
        assignment__is_active=True,
        assignment__weight__gt=0,
        grade__isnull=True,
    ).exists()
