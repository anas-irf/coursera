# notifications/api/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.api.errors import NotFound, ServiceError
from apps.core.api.params import int_param, object_body

from .. import services


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_notifications(request):
    """Get notifications for the current user"""
    notifications = services.get_user_notifications(
        user=request.user,
        limit=int_param(request, 'limit', 20, minimum=0),
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unread_notification_count(request):
    """Get count of unread notifications for the current user"""
    return Response({'unread_count': services.get_unread_count(request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark a notification as read"""
    if services.mark_as_read(notification_id, request.user):
        return Response({'message': 'Notification marked as read'})
    raise NotFound('Notification not found')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    """Mark every unread notification of the user as read, or only the ``ids`` that were sent."""
    ids = object_body(request).get('ids')
    if ids is not None and (not isinstance(ids, list) or not all(isinstance(i, int) for i in ids)):
        raise ServiceError('ids must be a list of notification ids')
    return Response({'marked_read': services.mark_all_read(request.user, ids)})
