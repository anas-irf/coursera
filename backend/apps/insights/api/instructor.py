# insights/api/instructor.py
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.courses.models import Course

from .. import instructor


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_dashboard(request):
    """Get dashboard overview stats for instructor"""
    return Response(instructor.dashboard(request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_earnings(request):
    """Get instructor earnings based on Coursera model"""
    if request.user.user_type != 'instructor':
        return Response({'error': 'Not an instructor'}, status=403)

    return Response(instructor.earnings(request.user))


@api_view(['GET'])
@permission_classes([IsInstructor])
def course_analytics(request, course_uuid):
    """Get course-specific analytics"""
    course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

    return Response(instructor.course_analytics(course))
