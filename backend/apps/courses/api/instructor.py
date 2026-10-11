# courses/api/instructor.py - the instructor's own courses
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.billing.models import InstructorEarning
from apps.learning.models import Enrollment

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
                              mixins.UpdateModelMixin,
                              viewsets.GenericViewSet):
    """Instructor course CRUD. There is no plain DELETE: courses are removed with
    the ``delete-course`` action, which requires a confirmation string."""
    permission_classes = [IsInstructor]
    serializer_class = CourseListSerializer

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
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
        try:
            data = []
            for course in self.get_queryset():
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

            return Response(data)
        except Exception:
            return Response([], status=200)  # Return empty list on error

    def create(self, request):
        """Create a new course"""
        serializer = CourseCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # Generate slug from title if not provided
            if 'slug' not in serializer.validated_data:
                serializer.validated_data['slug'] = slugify(serializer.validated_data['title'])

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

    def update(self, request, *args, **kwargs):
        """Override update to prevent editing published courses"""
        course = self.get_object()
        if course.status == 'published':
            return _published_course_response(course)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing published courses"""
        course = self.get_object()
        if course.status == 'published':
            return _published_course_response(course)
        return super().partial_update(request, *args, **kwargs)

    # The three actions below read enrollment and earning data; they move to the
    # learning / insights slices together with those slices.

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Get list of enrolled students"""
        course = self.get_object()
        enrollments = Enrollment.objects.filter(
            course=course
        ).select_related('student')
        
        data = [
            {
                'id': str(enrollment.student.uuid),
                'name': f"{enrollment.student.first_name} {enrollment.student.last_name}",
                'email': enrollment.student.email,
                'enrolled_date': enrollment.enrolled_date.isoformat(),
                'progress': float(enrollment.progress_percentage),
                'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
                'status': enrollment.status
            }
            for enrollment in enrollments
        ]
        
        return Response(data)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get course-specific analytics"""
        course = self.get_object()
        
        total_students = Enrollment.objects.filter(course=course).count()
        active_students = Enrollment.objects.filter(
            course=course,
            last_accessed__gte=timezone.now() - timedelta(days=7)
        ).count()
        
        completion_rate = 0
        if total_students > 0:
            completed = Enrollment.objects.filter(
                course=course,
                status='completed'
            ).count()
            completion_rate = (completed / total_students) * 100
        
        avg_progress = Enrollment.objects.filter(
            course=course
        ).aggregate(Avg('progress_percentage'))['progress_percentage__avg'] or 0
        
        total_revenue = InstructorEarning.objects.filter(
            course=course
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
        
        return Response({
            'total_students': total_students,
            'active_students': active_students,
            'completion_rate': float(completion_rate),
            'average_progress': float(avg_progress),
            'total_revenue': float(total_revenue),
            'average_rating': float(course.average_rating),
            'total_reviews': course.total_reviews,
            # reviews are not implemented; the key is kept for API compatibility
            'recent_reviews': []
        })

    @action(detail=False, methods=['get'], url_path='students')
    def students_list(self, request):
        """Get all students enrolled in instructor's courses"""
        try:
            instructor = request.user

            # Get all enrollments for instructor's courses
            enrollments = Enrollment.objects.filter(
                course__instructor=instructor
            ).select_related('student', 'course').order_by('-enrolled_date')

            students_data = []
            for enrollment in enrollments:
                # Handle name formatting - use email username if no first/last name
                first_name = enrollment.student.first_name or ''
                last_name = enrollment.student.last_name or ''
                full_name = f"{first_name} {last_name}".strip()
                if not full_name:
                    full_name = enrollment.student.email.split('@')[0].title()

                student_data = {
                    'id': str(enrollment.student.uuid),
                    'name': full_name,
                    'email': enrollment.student.email,
                    'avatar': f"https://ui-avatars.com/api/?name={full_name.replace(' ', '+')}&background=4F46E5&color=fff",
                    'courses_enrolled': [enrollment.course.title],
                    'progress': float(enrollment.progress_percentage),
                    'last_active': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
                    'enrolled_date': enrollment.enrolled_date.isoformat(),
                    'status': enrollment.status
                }
                students_data.append(student_data)

            # Group students by their ID to avoid duplicates and aggregate course data
            students_dict = {}
            for student_data in students_data:
                student_id = student_data['id']
                if student_id in students_dict:
                    # Add course to existing student
                    students_dict[student_id]['courses_enrolled'].extend(student_data['courses_enrolled'])
                    # Update progress to average
                    current_progress = students_dict[student_id]['progress']
                    new_progress = student_data['progress']
                    students_dict[student_id]['progress'] = (current_progress + new_progress) / 2
                    # Update last active to most recent
                    if student_data['last_active']:
                        if not students_dict[student_id]['last_active'] or student_data['last_active'] > students_dict[student_id]['last_active']:
                            students_dict[student_id]['last_active'] = student_data['last_active']
                else:
                    students_dict[student_id] = student_data

            # Convert back to list and format course count
            final_students = []
            for student in students_dict.values():
                student['courses_enrolled_count'] = len(student['courses_enrolled'])
                student['courses_enrolled'] = f"{len(student['courses_enrolled'])} courses"
                final_students.append(student)

            return Response(final_students)

        except Exception as e:
            return Response(
                {'error': f'Failed to fetch students: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
