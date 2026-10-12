# messaging/api/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .. import payloads, selectors, services


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    """Get all conversations for the authenticated user"""
    conversations = [
        {
            'id': summary.conversation_id,
            'other_user': payloads.person(summary.other_user),
            'last_message': summary.last_message.content,
            'last_message_time': summary.last_message.created_at,
            'last_message_sender': summary.last_message.sender_id,
            'unread_count': summary.unread_count,
            'message_count': summary.message_count,
        }
        for summary in selectors.conversations_for(request.user)
    ]
    return Response({'conversations': conversations})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation_messages(request, conversation_id):
    """Get all messages for a specific conversation (and mark them read)"""
    user = request.user
    messages = selectors.conversation_messages(user, conversation_id)

    if not messages.exists():
        return Response({'error': 'Conversation not found'}, status=404)

    services.mark_conversation_read(user, conversation_id)

    # evaluated after the update, so the incoming messages are reported as read
    return Response({'messages': [payloads.history_message(message, user) for message in messages]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):
    """Send a new message"""
    message = services.send_message(
        request.user, request.data.get('recipient_id'), request.data.get('content', '')
    )
    return Response(
        {'message': {**payloads.pushed_message(message), 'is_own_message': True}},
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_available_users(request):
    """Get list of users available for messaging (any user can message any other user)"""
    return Response({
        'users': [payloads.person(user) for user in selectors.available_users(request.user)]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_messages_read(request, conversation_id):
    """Mark all unread messages in a conversation as read for the current user"""
    updated_count = services.mark_conversation_read(request.user, conversation_id)

    return Response({
        'marked_read': updated_count,
        'conversation_id': conversation_id
    }, status=status.HTTP_200_OK)
