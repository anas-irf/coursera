"""Turn domain events into in-app notifications.

This module is the only place that knows which events produce which
notification, who receives it and what it says.  It is connected from
``NotificationsConfig.ready``.
"""
from django.contrib.auth import get_user_model
from django.dispatch import receiver

from apps.core import events

from .services import notify


def _name(user):
    return user.get_full_name() or user.email


# --- courses -------------------------------------------------------------- #
@receiver(events.course_submitted, dispatch_uid='notifications.course_submitted')
def course_submitted(sender, course, **kwargs):
    """Tell every admin that a course waits for review."""
    for admin in get_user_model().admins():
        notify(
            admin, 'course_submission',
            'New course submitted for review',
            f'A new course "{course.title}" by {_name(course.instructor)} has been submitted for review.'
            f'\n\nPlease review and approve or reject the course.',
            related=course, action_url='/admin/courses/approvals',
        )


@receiver(events.course_approved, dispatch_uid='notifications.course_approved')
def course_approved(sender, course, approved_by, **kwargs):
    notify(
        course.instructor, 'course_approved',
        f'Course "{course.title}" was approved!',
        f'Congratulations! Your course "{course.title}" has been approved and published by '
        f'{_name(approved_by)}.\n\nYour course is now live and available to students.',
        related=course, action_url='/instructor/courses',
    )
    # record for the admin who approved
    notify(
        approved_by, 'course_approved',
        f'Course "{course.title}" approved',
        f'You have successfully approved and published the course "{course.title}" by '
        f'{_name(course.instructor)}.\n\nThe course is now live and available to students.',
        related=course, action_url='/admin/courses',
    )


@receiver(events.course_rejected, dispatch_uid='notifications.course_rejected')
def course_rejected(sender, course, rejected_by, reason, **kwargs):
    notify(
        course.instructor, 'course_rejected',
        f'Course "{course.title}" was rejected',
        f'Your course "{course.title}" has been rejected by {_name(rejected_by)}.\n\n'
        f'Reason: {reason}\n\nYou can view the rejection details and resubmit your course '
        f'after addressing the feedback.',
        related=course, action_url='/instructor/courses',
    )
    notify(
        rejected_by, 'course_rejected',
        f'Course "{course.title}" rejected',
        f'You have successfully rejected the course "{course.title}" by '
        f'{_name(course.instructor)}.\n\nReason provided: {reason}',
        related=course, action_url='/admin/courses',
    )


# --- learning ------------------------------------------------------------- #
@receiver(events.student_enrolled, dispatch_uid='notifications.student_enrolled')
def student_enrolled(sender, enrollment, **kwargs):
    course = enrollment.course
    student = enrollment.student
    notify(
        student, 'enrollment',
        f'Successfully enrolled in "{course.title}"',
        f'Welcome! You have successfully enrolled in "{course.title}" by {_name(course.instructor)}.'
        f'\n\nYou can now start learning. Go to your dashboard to begin your first lesson.',
        related=course, action_url=f'/courses/{course.uuid}/learn',
    )
    notify(
        course.instructor, 'enrollment',
        f'New student enrolled in "{course.title}"',
        f'{_name(student)} has enrolled in your course "{course.title}".'
        f'\n\nYour course now has {course.total_enrolled} enrolled students.',
        related=enrollment, action_url='/instructor/courses',
    )


# --- assessments ---------------------------------------------------------- #
@receiver(events.assignment_graded, dispatch_uid='notifications.assignment_graded')
def assignment_graded(sender, submission, grade, graded_by, **kwargs):
    assignment = submission.assignment
    percentage = int((grade / assignment.max_points) * 100)
    notify(
        submission.student, 'assignment_graded',
        f'Assignment "{assignment.title}" has been graded',
        f'Your assignment "{assignment.title}" has been graded. You received '
        f'{grade}/{assignment.max_points} points ({percentage}%).',
        action_url=f'/courses/{assignment.course.uuid}/learn',
    )


# --- certificates --------------------------------------------------------- #
@receiver(events.certificate_issued, dispatch_uid='notifications.certificate_issued')
def certificate_issued(sender, certificate, **kwargs):
    course = certificate.course
    notify(
        certificate.student, 'certificate_earned',
        f'Certificate earned: "{course.title}"',
        f'Congratulations! You completed "{course.title}" and earned a certificate. '
        'You can download and share it from your certificates page.',
        related=certificate, action_url='/student/certificates',
    )


# --- billing -------------------------------------------------------------- #
def _admins():
    """Who hears about money: every admin (the name is kept, the audience is the one definition)."""
    return get_user_model().admins()


@receiver(events.subscription_activated, dispatch_uid='notifications.subscription_activated')
def subscription_activated(sender, user, subscription, **kwargs):
    plan = subscription.subscription_type
    notify(
        user, 'payment_success',
        '🎉 Welcome to Coursera Plus!',
        f'Your {plan} subscription has been activated. You now have access to all Plus courses!',
    )
    for admin in _admins():
        notify(
            admin, 'system',
            '💰 New Plus Subscription',
            f'User {user.email} just subscribed to Coursera Plus ({plan} plan)',
        )


@receiver(events.subscription_renewed, dispatch_uid='notifications.subscription_renewed')
def subscription_renewed(sender, user, subscription, next_billing_date, **kwargs):
    period = subscription.subscription_type.replace('ly', '')
    notify(
        user, 'payment_success',
        '✅ Subscription Renewed',
        f'Your Coursera Plus subscription has been renewed for another {period}. '
        f"Next billing: {next_billing_date.strftime('%B %d, %Y')}",
    )


@receiver(events.payment_failed, dispatch_uid='notifications.payment_failed')
def payment_failed(sender, user, subscription, attempt_count, amount_due, outcome, **kwargs):
    if outcome == 'warning':
        title = '⚠️ Payment Failed'
        message = (f"We couldn't process your payment of ${amount_due}. Your subscription is "
                   f"still active, but we'll try again soon.")
    elif outcome == 'suspended':
        title = '🚨 Subscription Suspended'
        message = (f'Your payment of ${amount_due} has failed {attempt_count} times. Your '
                   f'subscription has been suspended. Please update your payment method.')
        for admin in _admins():
            notify(
                admin, 'system',
                '🚨 Subscription Suspended',
                f'User {user.email} subscription suspended due to payment failures '
                f'({attempt_count} attempts)',
            )
    else:
        title = '⚠️ Payment Retry Failed'
        message = (f"Payment attempt #{attempt_count} failed. We'll keep trying. "
                   f'Your subscription remains active.')

    notify(user, 'payment_failed', title, message)
