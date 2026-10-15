"""Assignments: handing in, grading and getting the files back."""
import logging
import math
import mimetypes
import os
import re

from django.core.files.storage import default_storage
from django.utils import timezone

from apps.core.api.errors import NotFound, PermissionDenied, ServiceError
from apps.core.events import assignment_graded, emit
from apps.learning import selectors as learning_selectors
from apps.learning import services as learning

from ..models import AssignmentSubmission

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = ('.pdf', '.doc', '.docx', '.txt', '.rtf', '.jpg', '.jpeg', '.png', '.gif',
                      '.pptx', '.xlsx')
SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9._-]+$')
UNSAFE_PATTERNS = ('..', '/', '\\', '<script', '<?php', '<?xml', '.exe', '.bat', '.cmd', '.sh',
                   '.dll', '.scr', '.vbs', '.js', '.jar', '.class', '.php', '.asp')
EXECUTABLE_EXTENSIONS = ('.exe', '.bat', '.cmd', '.sh', '.scr', '.com', '.pif')


def validate_file(file):
    """Refuse a hand-in file that is too big, of a type that is not accepted, or named like an attack."""
    if file.size > MAX_FILE_BYTES:
        raise ServiceError('File size cannot exceed 50MB')

    extension = os.path.splitext(file.name)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ServiceError(
            f"File type {extension} not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}")

    filename = os.path.basename(file.name)
    if not SAFE_FILENAME.match(filename):
        raise ServiceError('Filename contains invalid characters. Only letters, numbers, dots, '
                           'hyphens and underscores are allowed.')

    lowered = filename.lower()
    if any(pattern in lowered for pattern in UNSAFE_PATTERNS):
        raise ServiceError('Filename contains unsafe patterns.')

    # file.txt.exe: every extension but the last one is checked
    if lowered.count('.') > 1:
        inner = re.findall(r'\.[a-zA-Z0-9]+', lowered)[:-1]
        if any(item in EXECUTABLE_EXTENSIONS for item in inner):
            raise ServiceError('File has suspicious double extension.')


def submit(student, assignment, text, file):
    """Hand in work for ``assignment``; returns the stored submission."""
    if not assignment.is_active:
        raise ServiceError('This assignment is not available')

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
    if file:
        validate_file(file)

    submission = AssignmentSubmission.objects.create(
        assignment=assignment,
        student=student,
        enrollment=enrollment,
        submission_text=text,
        submission_file=file,
        original_filename=file.name if file else '',
        is_late=is_late,
    )

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
