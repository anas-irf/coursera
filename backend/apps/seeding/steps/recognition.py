"""Certificates for the students who finished a course.

Nothing in the application issues certificates yet and ``Certificate.save`` cannot
build its own number, so the rows are written here with explicit numbers.
"""
import hashlib
from decimal import ROUND_HALF_UP, Decimal

from apps.assessments.models import Assignment, AssignmentSubmission, Quiz, QuizAttempt
from apps.certificates.models import Certificate
from apps.learning.models import Enrollment
from apps.notifications.services import notify

from ..clock import backdate_rows, notifications_at


def issue(ctx, enrollment, when):
    """Issue the certificate of a completed enrollment, dated ``when``."""
    student, course = enrollment.student, enrollment.course
    certificate = Certificate.objects.create(
        enrollment=enrollment, student=student, course=course,
        certificate_number=f'CERT-{course.uuid.hex[:8].upper()}-{enrollment.uuid.hex[:8].upper()}',
        verification_code=hashlib.sha256(
            f'{student.uuid}{course.uuid}{enrollment.uuid}'.encode()).hexdigest()[:20].upper(),
        completion_date=when,
        final_grade=final_grade(enrollment),
    )
    backdate_rows(Certificate.objects.filter(pk=certificate.pk),
                  issue_date=when, created_at=when, updated_at=when)
    backdate_rows(Enrollment.objects.filter(pk=enrollment.pk),
                  certificate_issued=True, certificate_issued_date=when)

    with notifications_at(when):
        notify(student, 'certificate_earned', f'Certificate earned: "{course.title}"',
               f'Congratulations! You completed "{course.title}" and earned a certificate. '
               'You can download and share it from your certificates page.',
               related=certificate, action_url='/student/certificates')
    ctx.count('certificates')
    return certificate


def final_grade(enrollment):
    """Weighted percentage over the graded work of a finished course.

    The application's own calculation only covers active enrollments, so the
    same rule is repeated here: best quiz attempt, graded assignments, weights.
    """
    course, student = enrollment.course, enrollment.student
    weighted = Decimal('0')
    weights = Decimal('0')

    for quiz in Quiz.objects.filter(course=course, is_active=True):
        best = (QuizAttempt.objects.filter(quiz=quiz, student=student, score__isnull=False)
                .order_by('-score').first())
        weighted += Decimal(best.score if best else 0) * quiz.weight
        weights += quiz.weight

    for assignment in Assignment.objects.filter(course=course, is_active=True):
        submission = AssignmentSubmission.objects.filter(
            assignment=assignment, student=student, grade__isnull=False).first()
        if submission is not None:
            weighted += Decimal(submission.grade) / assignment.max_points * 100 * assignment.weight
        weights += assignment.weight

    if not weights:
        return None
    return (weighted / weights).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
