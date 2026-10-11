"""Read side of messaging."""
from dataclasses import dataclass

from django.db.models import Count, Max, OuterRef, Q, Subquery

from apps.accounts.models import User

from .models import DirectMessage


@dataclass
class ConversationSummary:
    conversation_id: str
    other_user: User
    last_message: DirectMessage
    unread_count: int
    message_count: int


def _involving(user):
    return Q(sender=user) | Q(recipient=user)


def is_participant(user, conversation_id):
    """True when ``user`` sent or received a message of the conversation."""
    return DirectMessage.objects.filter(conversation_id=conversation_id).filter(_involving(user)).exists()


def conversation_messages(user, conversation_id):
    """The messages of a conversation that ``user`` takes part in, oldest first."""
    return (
        DirectMessage.objects.filter(conversation_id=conversation_id)
        .filter(_involving(user))
        .select_related('sender', 'recipient')
        .order_by('created_at')
    )


def conversations_for(user):
    """Every conversation of ``user`` with its newest message, most recent first."""
    rows = list(
        DirectMessage.objects.filter(_involving(user))
        .values('conversation_id')
        .annotate(
            latest_message_time=Max('created_at'),
            message_count=Count('id'),
            unread_count=Count('id', filter=Q(recipient=user, is_read=False)),
        )
        .order_by('-latest_message_time')
    )
    if not rows:
        return []

    newest = (
        DirectMessage.objects.filter(conversation_id=OuterRef('conversation_id'))
        .order_by('-created_at', '-id')
        .values('pk')[:1]
    )
    latest = {
        message.conversation_id: message
        for message in DirectMessage.objects.filter(
            conversation_id__in=[row['conversation_id'] for row in rows],
            pk=Subquery(newest),
        ).select_related('sender', 'recipient')
    }

    summaries = []
    for row in rows:
        message = latest[row['conversation_id']]
        summaries.append(ConversationSummary(
            conversation_id=row['conversation_id'],
            other_user=message.recipient if message.sender_id == user.id else message.sender,
            last_message=message,
            unread_count=row['unread_count'],
            message_count=row['message_count'],
        ))
    return summaries


def available_users(user):
    """Everybody ``user`` may write to (currently every other user)."""
    return User.objects.exclude(id=user.id)
