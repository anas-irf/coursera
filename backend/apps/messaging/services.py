"""Use-cases of messaging, shared by the REST views and the WebSocket consumers."""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from apps.accounts.models import User
from apps.core.api.errors import NotFound, PermissionDenied, ServiceError

from . import payloads, selectors
from .models import DirectMessage

logger = logging.getLogger(__name__)


def chat_group(conversation_id):
    """Channel group of everybody who has the conversation open."""
    return f'chat_{conversation_id}'


def user_group(user_id):
    """Channel group of all the sockets of one user."""
    return f'user_{user_id}'


def send_message(sender, recipient_id, content):
    """Store a message from ``sender`` and push it to the open sockets."""
    content = content.strip() if isinstance(content, str) else ''
    if not recipient_id or not content:
        raise ServiceError('recipient_id and content are required')

    try:
        recipient = User.objects.get(id=recipient_id)
    except (User.DoesNotExist, TypeError, ValueError):
        raise NotFound('Recipient not found') from None

    if recipient.pk == sender.pk:
        raise ServiceError('You cannot message yourself')
    # the REST endpoint and the socket both end up here, so the scope is enforced once
    if not selectors.available_users(sender).filter(pk=recipient.pk).exists():
        raise PermissionDenied('You cannot message this user')

    message = DirectMessage.objects.create(sender=sender, recipient=recipient, content=content)
    publish(message)
    return message


def publish(message):
    """Push a stored message to the conversation and to both users' sockets.

    Best effort: the message is already saved, so an unavailable channel layer
    must not fail the request; the recipient simply sees it on the next fetch.
    """
    event = {'type': 'chat_message', 'message': payloads.pushed_message(message)}
    try:
        layer = get_channel_layer()
        for group in (chat_group(message.conversation_id),
                      user_group(message.sender_id),
                      user_group(message.recipient_id)):
            async_to_sync(layer.group_send)(group, event)
    except Exception:
        logger.exception('Could not push message %s to its sockets', message.id)


def mark_conversation_read(user, conversation_id):
    """Mark what ``user`` received in the conversation as read; returns how many."""
    return DirectMessage.objects.filter(
        conversation_id=conversation_id,
        recipient=user,
        is_read=False,
    ).update(is_read=True, read_at=timezone.now())
