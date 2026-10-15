"""What a student does with assessments: attempt quizzes, hand in work, see grades."""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsStudent
from apps.core.api.throttling import UploadThrottle
from apps.learning import selectors as learning

from ..models import Assignment, Quiz
from ..services import assignments, grades, quizzes
from . import serializers


@api_view(['POST'])
@permission_classes([IsStudent])
def attempt_quiz(request, quiz_uuid):
    """Start or submit a quiz attempt with auto-grading"""
    quiz = get_object_or_404(Quiz, uuid=quiz_uuid)
    student = request.user

    enrollment = learning.enrollment_for_access(student, quiz.course)
    if enrollment is None:
        return Response(
            {'error': 'You must be enrolled in this course'},
            status=status.HTTP_403_FORBIDDEN
        )

    action = request.data.get('action', 'start')  # 'start' or 'submit'

    if action == 'start':
        attempt = quizzes.start_attempt(student, quiz, enrollment)
        return Response(serializers.quiz_start_payload(attempt, quiz))

    if action == 'submit':
        results = quizzes.submit_attempt(
            student, quiz, enrollment,
            request.data.get('attempt_id'),
            request.data.get('answers', {}),  # question_id -> answer
        )
        return Response({'success': True, 'results': results})

    return Response(
        {'error': 'Invalid action. Use "start" or "submit"'},
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([IsStudent])
@throttle_classes([UploadThrottle])
def submit_assignment(request, assignment_uuid):
    """Submit assignment with file upload"""
    assignment = get_object_or_404(Assignment, uuid=assignment_uuid)

    submission = assignments.submit(
        request.user,
        assignment,
        request.data.get('submission_text', ''),
        request.FILES.get('submission_file'),
    )

    return Response({
        'success': True,
        'message': 'Assignment submitted successfully',
        'submission': serializers.submission_receipt(submission),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_submission_file(request, submission_uuid):
    """Download assignment submission file"""
    submission = assignments.readable_submission(request.user, submission_uuid)
    content, content_type, filename = assignments.read_submission_file(submission)

    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Content-Length'] = len(content)
    return response


@api_view(['GET'])
@permission_classes([IsStudent])
def student_gradebook(request):
    """Get student's gradebook across all enrolled courses"""
    gradebook = grades.student_gradebook(request.user)

    return Response({
        'student': {
            'id': str(request.user.uuid),
            'name': f"{request.user.first_name} {request.user.last_name}",
            'email': request.user.email,
        },
        'courses': gradebook
    })
