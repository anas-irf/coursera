# courses/api/moderation.py - admin review of submitted courses
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from apps.core.api.pagination import paginate
from apps.core.api.params import object_body

from .. import selectors
from ..services import lifecycle
from . import serializers


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_pending_courses(request):
    """Get all courses pending admin review"""
    courses, headers = paginate(request, selectors.pending_review())

    return Response([serializers.pending_course_row(course) for course in courses], headers=headers)


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_approve_course(request, course_id):
    """Approve a course for publishing"""
    course = get_object_or_404(selectors.pending_review(), uuid=course_id)

    lifecycle.approve(course, request.user)

    return Response({
        'message': f'Course "{course.title}" has been approved and published',
        'course_id': str(course.uuid),
        'published_date': course.published_date.isoformat()
    })


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_reject_course(request, course_id):
    """Reject a course publishing request"""
    course = get_object_or_404(selectors.pending_review(), uuid=course_id)
    reason = object_body(request).get('reason') or ''

    if not isinstance(reason, str) or not reason.strip():
        return Response(
            {'error': 'Rejection reason is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    lifecycle.reject(course, request.user, reason)

    return Response({
        'message': f'Course "{course.title}" has been rejected',
        'course_id': str(course.uuid),
        'reason': reason,
        'rejected_by': request.user.get_full_name() or request.user.email,
        'rejection_date': course.rejection_date.isoformat()
    })


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_courses(request):
    """Get all courses for admin dashboard (whatever their status)"""
    courses, headers = paginate(request, selectors.all_courses())

    return Response([serializers.admin_course_row(course) for course in courses], headers=headers)
