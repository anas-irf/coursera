# assessments/api/instructor.py - grading side
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.courses.models import Course, Lecture

from .. import selectors
from ..models import Assignment, AssignmentSubmission, Question, Quiz
from ..services import assignments
from ..services.grades import course_gradebook
from . import serializers


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_assignments(request):
    """Get all assignments for the instructor's courses"""
    return Response([
        serializers.assignment_row(assignment)
        for assignment in selectors.instructor_assignments(request.user)
    ])


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_assignment_submissions(request, assignment_uuid):
    """Get all submissions for a specific assignment"""
    assignment = get_object_or_404(Assignment, uuid=assignment_uuid, course__instructor=request.user)

    return Response([
        serializers.submission_row(submission)
        for submission in selectors.assignment_submissions(assignment)
    ])


@api_view(['POST'])
@permission_classes([IsInstructor])
def grade_assignment_submission(request, submission_uuid):
    """Grade an assignment submission"""
    submission = get_object_or_404(
        AssignmentSubmission,
        uuid=submission_uuid,
        assignment__course__instructor=request.user
    )

    submission = assignments.grade(
        submission,
        request.user,
        request.data.get('grade'),
        request.data.get('feedback', ''),
    )

    return Response({
        'message': 'Assignment graded successfully',
        'submission': serializers.graded_submission(submission),
    })


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_course_gradebook(request, course_uuid):
    """Get gradebook for all students in instructor's course"""
    course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

    return Response(course_gradebook(course))


class QuizViewSet(viewsets.ViewSet):
    permission_classes = [IsInstructor]

    @action(detail=True, methods=['post'], url_path='reorder-questions')
    def reorder_questions(self, request, pk=None):
        """Reorder questions within a quiz (``pk`` is the uuid of the quiz lecture)"""
        lecture = get_object_or_404(
            Lecture,
            uuid=pk,
            content_type='quiz',
            section__course__instructor=request.user
        )
        quiz = get_object_or_404(Quiz, lecture=lecture)

        for item in request.data.get('question_orders', []):
            # unknown ids are skipped; ``id`` is the question's internal id
            question = Question.objects.filter(id=item.get('id'), quiz=quiz).first()
            if question is not None:
                question.order = item.get('order')
                question.save()

        return Response({'message': 'Quiz questions reordered successfully'})
