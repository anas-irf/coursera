# insights/api/student.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsStudent

from .. import student as student_insights


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_stats(request):
    """Get student learning statistics"""
    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can access stats'},
            status=status.HTTP_403_FORBIDDEN
        )

    return Response(student_insights.stats(request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_weekly_progress(request):
    """Get student's weekly learning progress (placeholder data)"""
    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can access weekly progress'},
            status=status.HTTP_403_FORBIDDEN
        )

    return Response(student_insights.weekly_progress())


@api_view(['GET'])
@permission_classes([IsStudent])
def student_achievements(request):
    """Get student achievements and gamification data"""
    return Response(student_insights.achievements(request.user))
