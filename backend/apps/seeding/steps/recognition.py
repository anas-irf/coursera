"""Certificates for the students who finished a course.

The application issues them itself: when a course completes with a passing grade, or when
the grade that was missing arrives (``apps.certificates``).  The seed only makes sure that a
story which promises a certificate got one, and dates it the day the story says the course
was finished.
"""
from apps.certificates import services
from apps.certificates.models import Certificate
from apps.learning.models import Enrollment
from apps.notifications.models import Notification

from ..clock import backdate_rows


def issue(ctx, enrollment, when):
    """Adopt the certificate of a completed enrollment and date it ``when``."""
    certificate = Certificate.objects.filter(enrollment=enrollment).first()
    if certificate is None:
        # the grade that earns it arrived after the course completed: ask once more
        certificate = services.issue_if_eligible(enrollment)
    if certificate is None:
        raise ValueError(
            f'{enrollment.student.email} / {enrollment.course.slug}: the story promises a '
            'certificate, but the grade does not earn one')

    backdate_rows(Certificate.objects.filter(pk=certificate.pk),
                  issue_date=when, completion_date=when, created_at=when, updated_at=when)
    backdate_rows(Enrollment.objects.filter(pk=enrollment.pk),
                  certificate_issued=True, certificate_issued_date=when)
    backdate_rows(
        Notification.objects.filter(recipient=enrollment.student, notification_type='certificate_earned',
                                    object_id=str(certificate.uuid)),
        created_at=when, updated_at=when)

    ctx.count('certificates')
    return certificate
