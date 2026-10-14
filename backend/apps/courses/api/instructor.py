# courses/api/instructor.py - the instructor's own courses
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.core.api.pagination import paginate

from .. import extensions
from ..models import Course
from ..services import courses as course_service
from ..services import lifecycle
from .serializers import CourseCreateSerializer, CourseDetailSerializer, CourseListSerializer


def _published_course_response(course):
    return Response(
        {
            'error': 'Cannot edit published courses. Please unpublish the course first.',
            'status': course.status
        },
        status=status.HTTP_400_BAD_REQUEST
    )


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
        return Course.objects.filter(instructor=self.request.user)

    def get_object(self):
        # Use UUID from URL
        queryset = self.get_queryset()
        obj = get_object_or_404(queryset, uuid=self.kwargs.get('pk'))
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """List all instructor's courses (slices above courses add columns, e.g. revenue)"""
        courses, headers = paginate(request, self.get_queryset().order_by('-created_at', 'id'))

        data = []
        for course in courses:
            row = {
                'id': str(course.uuid),
                'title': course.title,
                'status': course.status,
                'course_type': course.course_type,
                'total_enrolled': course.total_enrolled or 0,
                'average_rating': float(course.average_rating or 0),
                'created_at': course.created_at.isoformat(),
                'thumbnail': course.thumbnail.url if course.thumbnail else None
            }
            data.append(extensions.enrich_course_row(course, row))

        return Response(data, headers=headers)

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
            self.get_object(), request.user, request.data.get('confirmation', ''))

        return Response({
            'message': f'Course "{title}" has been permanently deleted.'
        }, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        """Change a course (not while it is published)"""
        course = self.get_object()
        if course.status == 'published':
            return _published_course_response(course)
        serializer = self.get_serializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
