"""Assignments: handing in, grading and getting the files back."""
import logging
import math
import mimetypes

from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.utils import timezone

from apps.core.api.errors import NotFound, PermissionDenied, ServiceError
from apps.core.events import assignment_graded, emit
from apps.learning import selectors as learning_selectors
from apps.learning import services as learning

from ..models import AssignmentSubmission

logger = logging.getLogger(__name__)


def submit(student, assignment, text, file):
    """Hand in work for ``assignment``; returns the stored submission."""
    enrollment = learning_selectors.enrollment_for_access(student, assignment.course)
    if enrollment is None:
        raise PermissionDenied('You must be enrolled in this course')

    now = timezone.now()
    is_late = bool(assignment.due_date and now > assignment.due_date)
    if is_late and not assignment.allow_late_submission:
        raise ServiceError('Assignment deadline has passed and late submissions are not allowed')

    if AssignmentSubmission.objects.filter(assignment=assignment, student=student).exists():
        raise ServiceError('You have already submitted this assignment')

    text = text if isinstance(text, str) else ''
    if not text.strip() and not file:
        raise ServiceError('Please provide either text submission or upload a file')

    try:
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=student,
            enrollment=enrollment,
            submission_text=text,
            submission_file=file,
            original_filename=file.name if file else '',
            is_late=is_late,
        )
    except ValidationError as error:
        # the model's own rules (file type, size, name) are the student's to fix
        raise ServiceError('; '.join(error.messages)) from error

    if assignment.lecture:
        learning.complete_lecture_once(enrollment, assignment.lecture)

    return submission


def grade(submission, grader, grade_value, feedback):
    """Store a grade and tell the student; ``grade_value`` is validated here."""
    if grade_value is None:
        raise ServiceError('Grade is required')

    try:
        points = float(grade_value)
    except (TypeError, ValueError):
        raise ServiceError('Grade must be a valid number') from None
    if not math.isfinite(points):
        raise ServiceError('Grade must be a valid number')

    max_points = submission.assignment.max_points
    if points < 0 or points > max_points:
        raise ServiceError(f'Grade must be between 0 and {max_points}')

    feedback = feedback.strip() if isinstance(feedback, str) else ''

    # a direct update: grading must not run the submission's own validation
    # (deadline, file rules), which only makes sense when the student hands in
    AssignmentSubmission.objects.filter(pk=submission.pk).update(
        grade=points,
        feedback=feedback,
        graded_by=grader,
        graded_at=timezone.now(),
    )
    submission.refresh_from_db()

    emit(assignment_graded, submission=submission, grade=points, graded_by=grader)
    return submission


def readable_submission(user, submission_uuid):
    """The submission ``user`` may download: own work for students, the course's for its instructor."""
    submission = (
        AssignmentSubmission.objects
        .select_related('assignment__course', 'student')
        .filter(uuid=submission_uuid)
        .first()
    )
    if submission is None:
        raise NotFound('Submission not found')

    if user.user_type == 'student':
        allowed = submission.student_id == user.id
    elif user.user_type == 'instructor':
        allowed = submission.assignment.course.instructor_id == user.id
    else:
        allowed = False
    if not allowed:
        raise NotFound('Submission not found')
    return submission


def read_submission_file(submission):
    """``(content, content_type, filename)`` of the stored file."""
    if not submission.submission_file:
        raise NotFound('No file attached to this submission')

    path = submission.submission_file.name
    if not default_storage.exists(path):
        raise NotFound('File not found on server')

    try:
        with default_storage.open(path) as stored:
            content = stored.read()
    except OSError:
        logger.exception('Could not read the stored file of submission %s', submission.pk)
        raise NotFound('Error reading file') from None

    content_type, _ = mimetypes.guess_type(submission.original_filename)
    return content, content_type or 'application/octet-stream', submission.original_filename
