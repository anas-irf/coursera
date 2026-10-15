"""Certificates are issued by reacting to what changes a student's standing.

Completing the course usually comes *before* the instructor has graded the last assignment, so
three events can be the one that makes a certificate due: the course completed, an assignment
graded, a quiz attempt finished (a retake can lift the grade).  Each asks the same idempotent
question.  Connected from ``CertificatesConfig.ready``.
"""
from django.dispatch import receiver

from apps.core import events

from . import services


@receiver(events.course_completed, dispatch_uid='certificates.course_completed')
def course_completed(sender, enrollment, **kwargs):
    services.issue_if_eligible(enrollment)


@receiver(events.assignment_graded, dispatch_uid='certificates.assignment_graded')
def assignment_graded(sender, submission, **kwargs):
    services.issue_if_eligible(submission.enrollment)


@receiver(events.quiz_attempt_finished, dispatch_uid='certificates.quiz_attempt_finished')
def quiz_attempt_finished(sender, attempt, **kwargs):
    services.issue_if_eligible(attempt.enrollment)
