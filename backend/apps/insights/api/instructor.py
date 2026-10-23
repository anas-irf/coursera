"""HTTP adapters of the instructor's dashboard, analytics and earnings."""

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.core.api.errors import ServiceError
from apps.core.api.params import int_param
from apps.courses.models import Course

from ..selectors import analytics, instructor


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_dashboard(request):
    """Get dashboard overview stats for instructor"""
    return Response(instructor.dashboard(request.user))


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_earnings(request):
    """Get instructor earnings based on Coursera model"""
    return Response(instructor.earnings(request.user))


@api_view(['GET'])
@permission_classes([IsInstructor])
def course_analytics(request, course_uuid):
    """Get course-specific analytics"""
    course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

    return Response(instructor.course_analytics(course))


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_analytics(request):
    """Learners, completion, quiz results and earnings of the instructor's courses, month by month."""
    months = int_param(request, 'months', analytics.PERIODS[1])
    if months not in analytics.PERIODS:
        raise ServiceError(f'months must be one of {", ".join(map(str, analytics.PERIODS))}')
    return Response(analytics.instructor_analytics(request.user, months))
