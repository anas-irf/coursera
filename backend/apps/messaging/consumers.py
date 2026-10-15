# messaging/consumers.py - authentication, group membership and frames; the rules live in services
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.core.api.errors import ServiceError

from . import selectors, services

logger = logging.getLogger(__name__)


class _MessageFrames:
    """Turns a group event into the frame the frontend expects."""

    async def chat_message(self, event):
        message = dict(event['message'])
        message['is_own_message'] = message['sender']['id'] == self.user.id
        await self.send(text_data=json.dumps({'type': 'chat_message', 'message': message}))


class ChatConsumer(_MessageFrames, AsyncWebsocketConsumer):
    """One conversation: ``/ws/chat/<conversation_id>/`` (participants only)."""

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.user = self.scope['user']
        self.group = services.chat_group(self.conversation_id)

        if self.user.is_anonymous:
            logger.warning('Anonymous user tried to open conversation %s', self.conversation_id)
            await self.close()
            return

        allowed = await database_sync_to_async(selectors.is_participant)(self.user, self.conversation_id)
        if not allowed:
            logger.warning('User %s may not open conversation %s', self.user.id, self.conversation_id)
            await self.close()
            return

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        logger.info('User %s joined conversation %s', self.user.id, self.conversation_id)

    async def disconnect(self, close_code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            # a binary frame is not part of the protocol; it must not take the socket down
            await self.send(text_data=json.dumps({'type': 'error', 'error': 'Binary frames are not supported'}))
            return
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            data = None
        if not isinstance(data, dict):
            logger.error('Invalid JSON received from user %s', self.user.id)
            await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))
            return

        frame_type = data.get('type', 'chat_message')
        if frame_type == 'chat_message':
            await self._send_chat_message(data)
        elif frame_type == 'typing':
            await self._broadcast_typing(data)

    async def _send_chat_message(self, data):
        try:
            await database_sync_to_async(services.send_message)(
                self.user, data.get('recipient_id'), data.get('message')
            )
        except ServiceError as exc:
            # the frame was not stored: the sender is told, so their screen does not pretend otherwise
            logger.warning('Chat frame from user %s refused: %s', self.user.id, exc.message)
            await self.send(text_data=json.dumps({'type': 'error', 'error': exc.message}))

    async def _broadcast_typing(self, data):
        await self.channel_layer.group_send(self.group, {
            'type': 'typing_indicator',
            'user_id': self.user.id,
            'is_typing': data.get('is_typing', False),
        })

    async def typing_indicator(self, event):
        # the typist does not get their own indicator back
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing'],
            }))


class UserConsumer(_MessageFrames, AsyncWebsocketConsumer):
    """Everything addressed to one user, across conversations: ``/ws/user/``."""

    async def connect(self):
        self.user = self.scope['user']

        if self.user.is_anonymous:
            logger.warning('Anonymous user tried to open the user socket')
            await self.close()
            return

        self.group = services.user_group(self.user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        logger.info('User %s opened the user socket', self.user.id)

    async def disconnect(self, close_code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)
