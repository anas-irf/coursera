from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Quiz, Question

class IsInstructor(IsAuthenticated):
    """Custom permission for instructors only"""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.user_type == 'instructor'

class QuizViewSet(viewsets.ViewSet):
    permission_classes = [IsInstructor]

    @action(detail=True, methods=['post'], url_path='reorder-questions')
    def reorder_questions(self, request, pk=None):
        """Reorder questions within a quiz"""
        try:
            # Get quiz by lecture UUID since that's how we identify quizzes
            from apps.courses.models import Lecture
            lecture = get_object_or_404(
                Lecture,
                uuid=pk,
                content_type='quiz',
                section__course__instructor=request.user
            )

            quiz = get_object_or_404(Quiz, lecture=lecture)
            question_orders = request.data.get('question_orders', [])

            for item in question_orders:
                question_id = item.get('id')  # Using internal ID for questions
                new_order = item.get('order')

                try:
                    question = Question.objects.get(
                        id=question_id,
                        quiz=quiz
                    )
                    question.order = new_order
                    question.save()  # This will update the updated_at field automatically
                except Question.DoesNotExist:
                    continue

            return Response({'message': 'Quiz questions reordered successfully'})

        except Exception as e:
            return Response(
                {'error': f'Failed to reorder quiz questions: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
