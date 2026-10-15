"""Issuing certificates: who has earned one, and the record that proves it.

A student earns a certificate when the course is **completed** and the **weighted grade is
passing** (``COURSE_PASSING_GRADE``).  Work that is still waiting for the instructor's grade
postpones the decision, and a course with nothing graded certifies on completion.

Nothing calls ``issue_if_eligible`` from the request that completes the course: the receivers
(``receivers.py``) do, on the events that can change the answer (the course completed, an
assignment graded, a quiz attempt finished), and it is idempotent, so the same enrollment never
gets a second certificate and a certificate's number never changes.
"""
import logging
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.assessments import selectors as assessments
from apps.assessments.services import grades
from apps.core.events import certificate_issued, emit
from apps.learning.models import Enrollment

from .models import Certificate

logger = logging.getLogger(__name__)

ATTEMPTS_AT_A_UNIQUE_NUMBER = 3


def verdict(enrollment):
    """``(eligible, grade)`` of a completed enrollment; ``grade`` is ``None`` for ungraded courses."""
    if enrollment.status != 'completed':
        return False, None
    if assessments.awaiting_grade(enrollment.student, enrollment.course):
        return False, None

    result = grades.calculate_student_course_grade(enrollment.student, enrollment.course)
    if result is None or not result['total_weight']:
        return True, None   # nothing in the course is graded
    grade = Decimal(str(result['final_grade'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return grade >= settings.COURSE_PASSING_GRADE, grade


def issue_if_eligible(enrollment, *, announce=True, issued_at=None):
    """Issue the certificate of ``enrollment`` when it has been earned; returns it, or ``None``.

    ``announce`` sends the ``certificate_issued`` event (the student is notified); the backfill
    command passes ``False`` unless asked.  ``issued_at`` dates a certificate that is issued
    late for something that completed earlier.
    """
    enrollment = Enrollment.objects.select_related('student', 'course').get(pk=enrollment.pk)

    existing = Certificate.objects.filter(enrollment=enrollment).first()
    if existing is not None:
        return existing

    eligible, grade = verdict(enrollment)
    if not eligible:
        return None

    certificate = _create(enrollment, grade)
    if certificate is None:
        return Certificate.objects.filter(enrollment=enrollment).first()  # another request won

    when = issued_at or certificate.issue_date
    if issued_at is not None:
        Certificate.objects.filter(pk=certificate.pk).update(issue_date=issued_at)
        certificate.issue_date = issued_at
    Enrollment.objects.filter(pk=enrollment.pk).update(certificate_issued=True, certificate_issued_date=when)

    if announce:
        emit(certificate_issued, certificate=certificate)
    return certificate


def _create(enrollment, grade):
    """Store the certificate; ``None`` when another request issued it first."""
    for _attempt in range(ATTEMPTS_AT_A_UNIQUE_NUMBER):
        try:
            with transaction.atomic():
                return Certificate.objects.create(
                    enrollment=enrollment,
                    student=enrollment.student,
                    course=enrollment.course,
                    completion_date=enrollment.completed_date or timezone.now(),
                    final_grade=grade,
                )
        except IntegrityError:
            if Certificate.objects.filter(enrollment=enrollment).exists():
                return None
            # a number or a code collided (one in 2**40): draw new ones
            logger.warning('Certificate number collided for enrollment %s, drawing again', enrollment.pk)
    raise IntegrityError(f'No unique certificate number for enrollment {enrollment.pk}')
