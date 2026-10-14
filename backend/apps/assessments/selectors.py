"""Read side of assessments."""
from django.db.models import Count, Q

from apps.learning import selectors as learning

from .models import Assignment, AssignmentSubmission


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
