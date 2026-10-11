# discussions/views.py
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q, Max, Count, Case, When
from django.contrib.auth import get_user_model
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

from .models import DirectMessage
from apps.accounts.models import User

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    """Get all conversations for the authenticated user"""
    user = request.user
    
    # Get all conversations with their latest message info
    conversations_data = DirectMessage.get_conversations_for_user(user)
    
    conversations_list = []
    for conv_data in conversations_data:
        conversation_id = conv_data['conversation_id']
        
        # Get the latest message for this conversation
        latest_message = DirectMessage.objects.filter(
            conversation_id=conversation_id
        ).select_related('sender', 'recipient').first()
        
        if latest_message:
            # Determine the other user
            other_user = latest_message.recipient if latest_message.sender == user else latest_message.sender
            
            # Double-check unread count calculation with explicit query
            actual_unread_count = DirectMessage.objects.filter(
                conversation_id=conversation_id,
                recipient=user,
                is_read=False
            ).count()
            
            conversations_list.append({
                'id': conversation_id,
                'other_user': {
                    'id': other_user.id,
                    'first_name': other_user.first_name or '',
                    'last_name': other_user.last_name or '',
                    'name': f"{other_user.first_name} {other_user.last_name}".strip() or other_user.email,
                    'email': other_user.email,
                    'user_type': other_user.user_type,
                    'avatar': f"https://ui-avatars.com/api/?name={other_user.first_name}+{other_user.last_name}&background=4F46E5&color=fff"
                },
                'last_message': latest_message.content,
                'last_message_time': latest_message.created_at,
                'last_message_sender': latest_message.sender.id,
                'unread_count': actual_unread_count,  # Use the explicit count
                'message_count': conv_data['message_count']
            })
    
    return Response({'conversations': conversations_list})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation_messages(request, conversation_id):
    """Get all messages for a specific conversation"""
    user = request.user
    
    # Verify user is part of this conversation
    messages = DirectMessage.objects.filter(
        conversation_id=conversation_id
    ).filter(
        Q(sender=user) | Q(recipient=user)
    ).select_related('sender', 'recipient').order_by('created_at')
    
    if not messages.exists():
        return Response({'error': 'Conversation not found'}, status=404)
    
    # Mark messages as read for the current user
    DirectMessage.objects.filter(
        conversation_id=conversation_id,
        recipient=user,
        is_read=False
    ).update(is_read=True, read_at=timezone.now())
    
    messages_data = []
    for message in messages:
        messages_data.append({
            'id': message.id,
            'sender': {
                'id': message.sender.id,
                'name': f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.email,
                'user_type': message.sender.user_type
            },
            'content': message.content,
            'created_at': message.created_at,
            'is_read': message.is_read,
            'is_own_message': message.sender == user
        })
    
    return Response({'messages': messages_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):
    """Send a new message"""
    sender = request.user
    recipient_id = request.data.get('recipient_id')
    content = request.data.get('content', '').strip()
    
    if not recipient_id or not content:
        return Response({
            'error': 'recipient_id and content are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        recipient = User.objects.get(id=recipient_id)
    except User.DoesNotExist:
        return Response({
            'error': 'Recipient not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Create the message
    message = DirectMessage.objects.create(
        sender=sender,
        recipient=recipient,
        content=content
    )
    
    # Prepare message data for WebSocket broadcasting
    message_data = {
        'id': message.id,
        'sender': {
            'id': sender.id,
            'name': f"{sender.first_name} {sender.last_name}".strip() or sender.email,
            'user_type': sender.user_type
        },
        'content': message.content,
        'created_at': message.created_at.isoformat(),
        'conversation_id': message.conversation_id
    }
    
    # Broadcast message via WebSocket
    channel_layer = get_channel_layer()
    
    # Send to conversation-specific group
    conversation_id = message.conversation_id
    async_to_sync(channel_layer.group_send)(
        f'chat_{conversation_id}',
        {
            'type': 'chat_message',
            'message': message_data
        }
    )
    
    # Send to both users' personal channels
    async_to_sync(channel_layer.group_send)(
        f'user_{sender.id}',
        {
            'type': 'chat_message', 
            'message': {**message_data, 'is_own_message': True}
        }
    )
    
    async_to_sync(channel_layer.group_send)(
        f'user_{recipient.id}',
        {
            'type': 'chat_message',
            'message': {**message_data, 'is_own_message': False}
        }
    )
    
    # Return the message data
    return Response({
        'message': {**message_data, 'is_own_message': True}
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_available_users(request):
    """Get list of users available for messaging (any user can message any other user)"""
    user = request.user
    
    # Any user can message any other user (excluding themselves)
    available_users = User.objects.exclude(id=user.id)
    
    users_data = []
    for user_obj in available_users:
        users_data.append({
            'id': user_obj.id,
            'first_name': user_obj.first_name,
            'last_name': user_obj.last_name,
            'name': f"{user_obj.first_name} {user_obj.last_name}".strip() or user_obj.email,
            'email': user_obj.email,
            'user_type': user_obj.user_type,
            'avatar': f"https://ui-avatars.com/api/?name={user_obj.first_name}+{user_obj.last_name}&background=4F46E5&color=fff"
        })
    
    return Response({'users': users_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_messages_read(request, conversation_id):
    """Mark all unread messages in a conversation as read for the current user"""
    user = request.user
    
    # Verify user is part of this conversation and mark messages as read
    updated_count = DirectMessage.objects.filter(
        conversation_id=conversation_id,
        recipient=user,
        is_read=False
    ).update(is_read=True, read_at=timezone.now())
    
    return Response({
        'marked_read': updated_count,
        'conversation_id': conversation_id
    }, status=status.HTTP_200_OK)
