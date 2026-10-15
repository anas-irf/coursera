"""Domain events -> notifications.

Slices announce events through ``apps.core.events``; the notifications slice
turns them into in-app notifications.  These tests drive the events directly
(the HTTP paths that emit them are covered by the endpoint suites).
"""
import logging
from decimal import Decimal

import pytest

import factories as f
from apps.core import events

pytestmark = pytest.mark.django_db


def _notes(user, notification_type=None):
    qs = f.Notification.objects.filter(recipient=user)
    if notification_type:
        qs = qs.filter(notification_type=notification_type)
    return list(qs)


def test_course_submitted_notifies_every_admin(instructor, admin):
    other_admin = f.make_admin()
    course = f.make_course(instructor, status='pending_review', title='Fresh course')

    events.emit(events.course_submitted, course=course)

    for user in (admin, other_admin):
        (note,) = _notes(user, 'course_submission')
        assert 'Fresh course' in note.message
        assert note.action_url == '/admin/courses/approvals'
    assert _notes(instructor) == []


def _superuser_of_another_type():
    """A superuser whose ``user_type`` is not 'admin'; ``is_admin`` is still true for them."""
    user = f.make_instructor()
    f.User.objects.filter(pk=user.pk).update(is_superuser=True)
    return user


def test_admin_alerts_reach_type_admins_and_superusers_alike(instructor):
    """One definition of "an admin" (``User.admins``): course submissions go to both kinds."""
    type_admin = f.make_admin()
    superuser = _superuser_of_another_type()
    course = f.make_course(instructor, status='pending_review')

    events.emit(events.course_submitted, course=course)

    for user in (type_admin, superuser):
        assert len(_notes(user, 'course_submission')) == 1


def test_payment_alerts_reach_type_admins_and_superusers_alike(student):
    type_admin = f.make_admin()
    superuser = _superuser_of_another_type()
    subscription = f.give_plus(student)

    events.emit(events.subscription_activated, user=student, subscription=subscription, amount=49.99)

    for user in (type_admin, superuser):
        assert [n.title for n in _notes(user, 'system')] == ['💰 New Plus Subscription']


def test_course_approved_notifies_instructor_and_the_approving_admin(instructor, admin):
    course = f.make_course(instructor, status='published', title='Approved one')

    events.emit(events.course_approved, course=course, approved_by=admin)

    (to_instructor,) = _notes(instructor, 'course_approved')
    assert to_instructor.title == 'Course "Approved one" was approved!'
    assert to_instructor.action_url == '/instructor/courses'
    assert to_instructor.object_id == str(course.uuid)
    (to_admin,) = _notes(admin, 'course_approved')
    assert to_admin.action_url == '/admin/courses'


def test_course_rejected_carries_the_reason(instructor, admin):
    course = f.make_course(instructor, status='rejected', title='Rejected one')

    events.emit(events.course_rejected, course=course, rejected_by=admin, reason='Too short')

    (note,) = _notes(instructor, 'course_rejected')
    assert 'Reason: Too short' in note.message
    assert 'Too short' in _notes(admin, 'course_rejected')[0].message


def test_student_enrolled_notifies_student_and_instructor(instructor, student):
    course = f.make_course(instructor, status='published', title='Enroll me')
    enrollment = f.enroll(student, course)

    events.emit(events.student_enrolled, enrollment=enrollment)

    (to_student,) = _notes(student, 'enrollment')
    assert to_student.action_url == f'/courses/{course.uuid}/learn'
    (to_instructor,) = _notes(instructor, 'enrollment')
    assert to_instructor.object_id == str(enrollment.uuid)


def test_assignment_graded_notifies_the_student(instructor, student):
    built = f.build_course(instructor)
    f.enroll(student, built.course)
    submission = f.make_submission(built.assignment, student)

    events.emit(events.assignment_graded, submission=submission,
                grade=Decimal('45'), graded_by=instructor)

    (note,) = _notes(student, 'assignment_graded')
    assert '45/100 points (45%)' in note.message
    assert note.action_url == f'/courses/{built.course.uuid}/learn'


def test_subscription_events_notify_user_and_superusers(student):
    root = f.make_user('admin', email='root@example.com')
    root.is_superuser = True
    root.save()
    subscription = f.give_plus(student)

    events.emit(events.subscription_activated, user=student, subscription=subscription, amount=49.99)
    assert [n.notification_type for n in _notes(student)] == ['payment_success']
    assert [n.notification_type for n in _notes(root)] == ['system']

    events.emit(events.payment_failed, user=student, subscription=subscription,
                attempt_count=1, amount_due=49.99, outcome='warning')
    assert 'Payment Failed' in _notes(student, 'payment_failed')[0].title


def test_a_failing_receiver_never_breaks_the_emitter(caplog, instructor):
    """Events are best-effort: the error is logged, the other receivers still run."""
    def broken(sender, **kwargs):
        raise RuntimeError('receiver exploded')

    events.course_submitted.connect(broken, dispatch_uid='tests.broken_receiver')
    try:
        admin = f.make_admin()
        course = f.make_course(instructor, status='pending_review')
        with caplog.at_level(logging.ERROR):
            events.emit(events.course_submitted, course=course)  # must not raise
    finally:
        events.course_submitted.disconnect(dispatch_uid='tests.broken_receiver')

    assert len(_notes(admin, 'course_submission')) == 1
    assert any('exploded' in record.getMessage() or 'receiver' in record.getMessage().lower()
               for record in caplog.records)
