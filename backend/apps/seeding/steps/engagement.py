"""Engagement: conversations, notifications no application event produces, what was read.

Direct messages are written straight to the table: the service would push them
to sockets nobody has open.  The notifications of the events (enrolments,
grades, approvals, payments) already exist; this step adds the kinds the
application has no emitter for yet and then marks everything older than two
weeks as read, so every bell shows a realistic mix.
"""
from datetime import timedelta

from django.db.models import F

from apps.messaging.models import DirectMessage
from apps.notifications.models import Notification
from apps.notifications.services import notify

from ..clock import backdate, backdate_rows
from ..data.messages import NOTES, THREADS
from ..data.people import EMAILS

TITLE = 'Messages and notifications'
READ_AFTER_DAYS = 14


def run(ctx):
    threads = sum(_thread(ctx, thread) for thread in THREADS)
    notes = sum(_note(ctx, note) for note in NOTES)
    _read_the_old_ones(ctx)

    ctx.count('conversations', threads)
    ctx.count('notifications (hand-made)', notes)
    ctx.say(f'   {threads} conversations and {notes} extra notifications created')


def _thread(ctx, thread):
    a, b = ctx.users[thread.a], ctx.users[thread.b]
    conversation = DirectMessage.get_conversation_id(a, b)
    if DirectMessage.objects.filter(conversation_id=conversation).exists():
        return 0

    count = len(thread.lines)
    step = (thread.started - thread.ended) / max(count - 1, 1)
    target = a if thread.unread_for == 'a' else b

    messages = []
    for index, (speaker, text) in enumerate(thread.lines):
        sender, recipient = (a, b) if speaker == 'a' else (b, a)
        when = ctx.ago(days=thread.started - step * index)
        message = DirectMessage.objects.create(sender=sender, recipient=recipient, content=text)
        messages.append((message, when))

    to_target = [message for message, _ in messages if message.recipient_id == target.id]
    unread = {message.pk for message in to_target[len(to_target) - thread.unread:]} if thread.unread else set()

    for message, when in messages:
        read = message.pk not in unread
        backdate(message, created_at=when, updated_at=when, is_read=read,
                 read_at=when + timedelta(minutes=20) if read else None)
    return 1


def _note(ctx, note):
    user = ctx.users[note.email]
    if Notification.objects.filter(recipient=user, notification_type=note.kind, title=note.title).exists():
        return 0
    when = ctx.ago(hours=note.hours)
    notification = notify(user, note.kind, note.title, note.message, action_url=note.url)
    fields = {'created_at': when, 'updated_at': when}
    if note.read:
        fields.update(is_read=True, read_at=when + timedelta(hours=2))
    backdate(notification, **fields)
    return 1


def _read_the_old_ones(ctx):
    old = Notification.objects.filter(recipient__email__in=EMAILS, is_read=False,
                                     created_at__lt=ctx.ago(READ_AFTER_DAYS))
    backdate_rows(old, is_read=True, read_at=F('created_at') + timedelta(days=1))
