# courses/api/moderation.py - admin review of submitted courses
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin

from .. import extensions
from ..models import Course
from ..services import lifecycle


def _course_summary(course):
    """Fields shared by the pending and the all-courses admin lists."""
    return {
        'id': str(course.uuid),
        'title': course.title,
        'instructor': {
            'id': str(course.instructor.uuid),
            'name': f"{course.instructor.first_name} {course.instructor.last_name}".strip() or course.instructor.email,
            'email': course.instructor.email
        },
        'category': course.category.name if course.category else 'Uncategorized',
        'course_type': course.course_type,
        'sections_count': course.sections.count(),
        'lectures_count': sum(section.lectures.count() for section in course.sections.all()),
        'total_weight': float(extensions.total_grade_weight(course)),
        'description': course.description,
        'thumbnail': course.thumbnail.url if course.thumbnail else None,
        'duration_hours': float(course.duration_hours) if course.duration_hours else 0
    }


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_pending_courses(request):
    """Get all courses pending admin review"""
    try:
        pending_courses = Course.objects.filter(
            status='pending_review'
        ).select_related('instructor').order_by('-updated_at')

        data = []
        for course in pending_courses:
            row = _course_summary(course)
            row['submitted_date'] = course.updated_at.isoformat()
            data.append(row)

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to fetch pending courses: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_approve_course(request, course_id):
    """Approve a course for publishing"""
    course = get_object_or_404(Course, uuid=course_id, status='pending_review')

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
    course = get_object_or_404(Course, uuid=course_id, status='pending_review')
    reason = request.data.get('reason', '')

    if not reason.strip():
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
    """Get all courses for admin dashboard"""
    try:
        # Get all courses regardless of status
        all_courses = Course.objects.select_related('instructor').order_by('-created_at')

        data = []
        for course in all_courses:
            row = _course_summary(course)
            row.update({
                'status': course.status,
                'created_date': course.created_at.isoformat(),
                'published_date': course.published_date.isoformat() if course.published_date else None,
                'total_enrolled': course.total_enrolled,
                'average_rating': float(course.average_rating) if course.average_rating else 0,
            })
            data.append(row)

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to fetch all courses: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
