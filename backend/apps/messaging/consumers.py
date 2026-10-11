# discussions/consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import DirectMessage

User = get_user_model()
logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get the conversation ID from the URL
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        
        # Get the user from the scope
        self.user = self.scope["user"]
        
        logger.info(f"WebSocket connection attempt for user: {self.user}, conversation: {self.conversation_id}")
        
        # Check if user is authenticated
        if self.user.is_anonymous:
            logger.warning(f"Anonymous user attempted to connect to conversation: {self.conversation_id}")
            await self.close()
            return
        
        # Check if user is part of this conversation
        if not await self.user_in_conversation():
            logger.warning(f"User {self.user.email} not authorized for conversation: {self.conversation_id}")
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        logger.info(f"User {self.user.email} successfully connected to conversation: {self.conversation_id}")
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            logger.info(f"User {getattr(self.user, 'email', 'Unknown')} disconnected from conversation: {self.conversation_id}")

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'chat_message')
            
            logger.info(f"Received WebSocket message type: {message_type} from user: {self.user.email}")
            
            if message_type == 'chat_message':
                await self.handle_chat_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
        except json.JSONDecodeError:
            logger.error("Invalid JSON received in WebSocket message")
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON'
            }))

    async def handle_chat_message(self, data):
        message_content = data.get('message', '').strip()
        recipient_id = data.get('recipient_id')
        
        logger.info(f"Processing chat message from {self.user.email} to recipient {recipient_id}")
        
        if not message_content or not recipient_id:
            logger.warning("Missing message content or recipient_id")
            return
        
        # Get recipient
        recipient = await self.get_user(recipient_id)
        if not recipient:
            logger.warning(f"Recipient with ID {recipient_id} not found")
            return
        
        # Save message to database
        message = await self.save_message(self.user, recipient, message_content)
        logger.info(f"Message saved with ID: {message.id}, conversation_id: {message.conversation_id}")
        
        # Send message to room group (both users should be in the same group)
        broadcast_data = {
            'type': 'chat_message',
            'message_id': message.id,
            'message': message.content,
            'sender_id': message.sender.id,
            'sender_name': f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.email,
            'timestamp': message.created_at.isoformat(),
            'conversation_id': message.conversation_id
        }
        
        logger.info(f"Broadcasting message to group: {self.room_group_name}, data: {broadcast_data}")
        
        await self.channel_layer.group_send(
            self.room_group_name,
            broadcast_data
        )
        
        # Also send to individual user groups for notification purposes
        sender_group = f'user_{message.sender.id}'
        recipient_group = f'user_{message.recipient.id}'
        
        # Send to sender's personal group
        await self.channel_layer.group_send(
            sender_group,
            {**broadcast_data, 'type': 'user_message_notification'}
        )
        
        # Send to recipient's personal group
        await self.channel_layer.group_send(
            recipient_group,
            {**broadcast_data, 'type': 'user_message_notification'}
        )

    async def handle_typing(self, data):
        is_typing = data.get('is_typing', False)
        
        # Send typing indicator to room group (excluding sender)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'is_typing': is_typing
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        # Send message to WebSocket in the format frontend expects
        logger.info(f"ChatConsumer: Sending message to WebSocket client: {event}")
        
        # Handle both old format (from WebSocket) and new format (from API)
        if 'message' in event and isinstance(event['message'], dict):
            # New format from API
            message_data = event['message']
            response_data = {
                'type': 'chat_message',
                'message': {
                    'id': message_data['id'],
                    'sender': message_data['sender'],
                    'content': message_data['content'],
                    'created_at': message_data['created_at'],
                    'conversation_id': message_data['conversation_id'],
                    'is_own_message': message_data.get('is_own_message', message_data['sender']['id'] == self.user.id)
                }
            }
            logger.info(f"ChatConsumer: Sending new format message: {response_data}")
            await self.send(text_data=json.dumps(response_data))
        else:
            # Old format from WebSocket
            response_data = {
                'type': 'chat_message',
                'message_id': event.get('message_id'),
                'message': event.get('message'),
                'sender_id': event.get('sender_id'),
                'sender_name': event.get('sender_name'),
                'timestamp': event.get('timestamp'),
                'conversation_id': event.get('conversation_id')
            }
            logger.info(f"ChatConsumer: Sending old format message: {response_data}")
            await self.send(text_data=json.dumps(response_data))

    # Receive typing indicator from room group
    async def typing_indicator(self, event):
        # Don't send typing indicator to the person who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing']
            }))

    @database_sync_to_async
    def user_in_conversation(self):
        """Check if user is part of this conversation"""
        from django.db.models import Q
        return DirectMessage.objects.filter(
            conversation_id=self.conversation_id
        ).filter(
            Q(sender=self.user) | Q(recipient=self.user)
        ).exists()

    @database_sync_to_async
    def get_user(self, user_id):
        """Get user by ID"""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, sender, recipient, content):
        """Save message to database"""
        return DirectMessage.objects.create(
            sender=sender,
            recipient=recipient,
            content=content
        )


class UserConsumer(AsyncWebsocketConsumer):
    """
    Consumer for user-specific WebSocket connections.
    Handles notifications for messages across all conversations.
    """
    
    async def connect(self):
        self.user = self.scope["user"]
        
        logger.info(f"User-specific WebSocket connection attempt for user: {self.user}")
        
        # Check if user is authenticated
        if self.user.is_anonymous:
            logger.warning("Anonymous user attempted to connect to user-specific WebSocket")
            await self.close()
            return
        
        # Create user-specific group
        self.user_group_name = f'user_{self.user.id}'
        
        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        logger.info(f"User {self.user.email} connected to user-specific WebSocket")
        await self.accept()
    
    async def disconnect(self, close_code):
        # Leave user group
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
            logger.info(f"User {getattr(self.user, 'email', 'Unknown')} disconnected from user-specific WebSocket")
    
    async def chat_message(self, event):
        """Handle chat messages sent to this user"""
        logger.info(f"UserConsumer: Sending chat message to user: {self.user.email}")
        
        # Handle both old format (from WebSocket) and new format (from API)
        if 'message' in event and isinstance(event['message'], dict):
            # New format from API
            message_data = event['message']
            response_data = {
                'type': 'chat_message',
                'message': {
                    'id': message_data['id'],
                    'sender': message_data['sender'],
                    'content': message_data['content'],
                    'created_at': message_data['created_at'],
                    'conversation_id': message_data['conversation_id'],
                    'is_own_message': message_data.get('is_own_message', message_data['sender']['id'] == self.user.id)
                }
            }
            logger.info(f"UserConsumer: Sending new format message: {response_data}")
            await self.send(text_data=json.dumps(response_data))
        else:
            # Old format from WebSocket or legacy notifications
            response_data = {
                'type': 'chat_message',
                'message_id': event.get('message_id'),
                'message': event.get('message'),
                'sender_id': event.get('sender_id'),
                'sender_name': event.get('sender_name'),
                'timestamp': event.get('timestamp'),
                'conversation_id': event.get('conversation_id')
            }
            logger.info(f"UserConsumer: Sending old format message: {response_data}")
            await self.send(text_data=json.dumps(response_data))
    
    async def user_message_notification(self, event):
        """Handle message notifications for this user (legacy method)"""
        logger.info(f"UserConsumer: Sending message notification to user: {self.user.email}")
        # Use the same logic as chat_message for consistency
        await self.chat_message(event)
