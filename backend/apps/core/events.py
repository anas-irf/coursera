"""Domain events.

Slices announce that something happened by sending one of these signals through
``emit``; other slices (today: ``notifications``) subscribe to them.  Keeping
the catalogue in the bottom layer means the emitting slice never has to import
the slice that reacts, so dependencies keep pointing downwards.

Every event is emitted *after* the state change has been saved and is
best-effort: a failing receiver is logged and never breaks the request.
"""
import logging

from django.dispatch import Signal

logger = logging.getLogger(__name__)

# --- courses -------------------------------------------------------------- #
course_submitted = Signal()   # course
course_approved = Signal()    # course, approved_by
course_rejected = Signal()    # course, rejected_by, reason

# --- learning ------------------------------------------------------------- #
student_enrolled = Signal()   # enrollment

# --- assessments ---------------------------------------------------------- #
assignment_graded = Signal()  # submission, grade, graded_by

# --- billing -------------------------------------------------------------- #
subscription_activated = Signal()  # user, subscription, amount
subscription_renewed = Signal()    # user, subscription, next_billing_date
payment_failed = Signal()          # user, subscription, attempt_count, amount_due, outcome
#   outcome is one of: 'warning' (first failure), 'retrying', 'suspended'


def emit(signal, **payload):
    """Send ``signal`` and never raise: receiver errors are logged, not propagated."""
    for receiver, result in signal.send_robust(sender=None, **payload):
        if isinstance(result, Exception):
            logger.error('Event receiver %s failed: %r', getattr(receiver, '__qualname__', receiver), result,
                         exc_info=result)
