# insights/api/student.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsStudent

from .. import student as student_insights


@api_view(['GET'])
@permission_classes([IsStudent])
def student_stats(request):
    """Get student learning statistics"""
    return Response(student_insights.stats(request.user))


@api_view(['GET'])
@permission_classes([IsStudent])
def student_weekly_progress(request):
    """Hours learned in each of the last months, from the learning log"""
    return Response(student_insights.weekly_progress(request.user))


@api_view(['GET'])
@permission_classes([IsStudent])
def student_achievements(request):
    """Get student achievements and gamification data"""
    return Response(student_insights.achievements(request.user))
