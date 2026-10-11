# notifications/api/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .. import services


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_notifications(request):
    """Get notifications for the current user"""
    try:
        notifications = services.get_user_notifications(
            user=request.user,
            limit=int(request.GET.get('limit', 20)),
            include_read=request.GET.get('include_read', 'true').lower() == 'true'
        )

        data = []
        for notification in notifications:
            data.append({
                'id': notification.id,
                'type': notification.notification_type,
                'title': notification.title,
                'message': notification.message,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat(),
                'read_at': notification.read_at.isoformat() if notification.read_at else None,
                'action_url': notification.action_url,
            })

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get notifications: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unread_notification_count(request):
    """Get count of unread notifications for the current user"""
    try:
        count = services.get_unread_count(request.user)
        return Response({'unread_count': count})

    except Exception as e:
        return Response(
            {'error': f'Failed to get notification count: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark a notification as read"""
    try:
        notification = services.mark_as_read(notification_id, request.user)
        if notification:
            return Response({'message': 'Notification marked as read'})
        return Response(
            {'error': 'Notification not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    except Exception as e:
        return Response(
            {'error': f'Failed to mark notification as read: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
