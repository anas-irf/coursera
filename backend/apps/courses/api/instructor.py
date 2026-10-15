# courses/api/instructor.py - the instructor's own courses
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.core.api.pagination import paginate
from apps.core.api.params import object_body

from .. import selectors
from ..services import courses as course_service
from ..services import lifecycle
from . import serializers
from .serializers import CourseCreateSerializer, CourseDetailSerializer, CourseListSerializer


class InstructorCourseViewSet(mixins.CreateModelMixin,
                              mixins.ListModelMixin,
                              mixins.RetrieveModelMixin,
                              viewsets.GenericViewSet):
    """Instructor course CRUD. There is no plain DELETE (courses are removed with the
    ``delete-course`` action, which requires a confirmation string) and no PUT: a course
    is changed with PATCH, which is what the frontend sends."""
    permission_classes = [IsInstructor]
    serializer_class = CourseListSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'partial_update']:
            return CourseCreateSerializer
        elif self.action == 'retrieve':
            return CourseDetailSerializer
        return CourseListSerializer

    def get_queryset(self):
        return selectors.instructor_courses(self.request.user)

    def get_object(self):
        # Use UUID from URL
        obj = get_object_or_404(self.get_queryset(), uuid=self.kwargs.get('pk'))
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """List all instructor's courses (slices above courses add columns, e.g. revenue)"""
        courses, headers = paginate(request, self.get_queryset().order_by('-created_at', 'id'))

        return Response(
            [serializers.instructor_course_row(course) for course in courses], headers=headers)

    def create(self, request):
        """Create a new course"""
        serializer = CourseCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            course = serializer.save(instructor=request.user)
            return Response({
                'id': str(course.uuid),
                'message': 'Course created successfully',
                'title': course.title
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def apply_for_publish(self, request, pk=None):
        """Apply for course publishing - only if grade weights = 100%"""
        lifecycle.submit_for_review(self.get_object())

        return Response({
            'status': 'pending_review',
            'message': 'Course submitted for admin review. You will be notified once it is approved.'
        })

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Unpublish a course - instructor only"""
        course = lifecycle.unpublish(self.get_object())

        return Response({
            'message': f'Course "{course.title}" has been unpublished',
            'course_id': str(course.uuid),
            'status': course.status
        })

    @action(detail=True, methods=['post'], url_path='delete-course')
    def delete_course(self, request, pk=None):
        """Delete a course with confirmation"""
        title = course_service.delete_course(
            self.get_object(), request.user, object_body(request).get('confirmation', ''))

        return Response({
            'message': f'Course "{title}" has been permanently deleted.'
        }, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        """Change a course (not while it is published)"""
        course = self.get_object()
        course_service.ensure_editable(course)
        serializer = self.get_serializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def categories(request):
    """Categories a course can be filed under (what the create form offers)."""
    return Response([serializers.category_row(category) for category in selectors.active_categories()])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def languages(request):
    """Languages a course can be taught in."""
    return Response([serializers.language_row(language) for language in selectors.languages()])
