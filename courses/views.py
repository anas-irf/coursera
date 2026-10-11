# courses/views.py
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.db.models import Count, Avg, Sum, Q, F, Max
from datetime import datetime, timedelta
from django.utils import timezone
from django.utils.text import slugify
from decimal import Decimal

from .models import Course, Section, Lecture, CourseAnnouncement
from .serializers import (
    CourseListSerializer, CourseDetailSerializer, CourseCreateSerializer,
    SectionSerializer, LectureSerializer
)
from enrollments.models import Enrollment
from payments.models import InstructorEarning
from notifications.services import NotificationService
from notifications.models import Notification
from assessments.models import Quiz, Question, QuestionOption, Assignment

class IsInstructor(IsAuthenticated):
    """Custom permission for instructors only"""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.user_type == 'instructor'

class IsAdmin(IsAuthenticated):
    """Custom permission for admins only"""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_admin

class IsStudent(IsAuthenticated):
    """Custom permission for students only"""
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.user_type == 'student'


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_dashboard(request):
    """Get dashboard overview stats for instructor"""
    try:
        instructor = request.user
        
        # Get all instructor's courses
        courses = Course.objects.filter(instructor=instructor)
        
        # Calculate stats
        total_students = Enrollment.objects.filter(
            course__instructor=instructor
        ).values('student').distinct().count()
        
        total_revenue = InstructorEarning.objects.filter(
            instructor=instructor
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
        
        avg_rating = courses.aggregate(
            avg=Avg('average_rating')
        )['avg'] or Decimal('0')
        
        # Recent enrollments (last 10)
        recent_enrollments = Enrollment.objects.filter(
            course__instructor=instructor
        ).select_related('student', 'course').order_by('-enrolled_date')[:10]
        
        recent_enrollments_data = [
            {
                'student_name': f"{e.student.first_name} {e.student.last_name}",
                'student_email': e.student.email,
                'course_title': e.course.title,
                'enrolled_date': e.enrolled_date.isoformat()
            }
            for e in recent_enrollments
        ]
        
        # Revenue chart data (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        revenue_by_day = {}
        
        earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            created_at__gte=thirty_days_ago
        ).values('created_at__date').annotate(
            daily_revenue=Sum('final_amount')
        )
        
        # Fill in missing days with 0
        for i in range(30):
            date = (timezone.now() - timedelta(days=29-i)).date()
            revenue_by_day[date.isoformat()] = 0
        
        for earning in earnings:
            date_str = earning['created_at__date'].isoformat()
            revenue_by_day[date_str] = float(earning['daily_revenue'])
        
        revenue_chart = [
            {'date': date, 'revenue': revenue}
            for date, revenue in revenue_by_day.items()
        ]
        revenue_chart.sort(key=lambda x: x['date'])
        
        # Top performing courses
        top_courses_qs = courses.annotate(
            total_revenue=Sum('earnings__final_amount')
        ).order_by('-total_revenue')[:3]
        
        top_courses_data = []
        for course in top_courses_qs:
            revenue = InstructorEarning.objects.filter(
                course=course
            ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
            
            top_courses_data.append({
                'id': str(course.uuid),
                'title': course.title,
                'course_type': course.course_type,  # Add course_type
                'total_enrolled': course.total_enrolled,
                'average_rating': float(course.average_rating),
                'total_revenue': float(revenue),
                'thumbnail': course.thumbnail.url if course.thumbnail else None
            })
        
        return Response({
            'stats': {
                'total_courses': courses.count(),
                'total_students': total_students,
                'total_revenue': float(total_revenue),
                'average_rating': float(avg_rating),
                'published_courses': courses.filter(status='published').count(),
                'draft_courses': courses.filter(status='draft').count(),
            },
            'recent_enrollments': recent_enrollments_data,
            'revenue_chart': revenue_chart,
            'top_courses': top_courses_data
        })
        
    except Exception as e:
        # Return safe fallback data
        return Response({
            'stats': {
                'total_courses': 0,
                'total_students': 0,
                'total_revenue': 0,
                'average_rating': 0,
                'published_courses': 0,
                'draft_courses': 0,
            },
            'recent_enrollments': [],
            'revenue_chart': [],
            'top_courses': [],
            'error': str(e) if request.user.is_staff else 'Unable to load dashboard data'
        })

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
        """List all instructor's courses with revenue data"""
        try:
            courses = self.get_queryset()
            data = []
            
            for course in courses:
                try:
                    revenue = InstructorEarning.objects.filter(
                        course=course
                    ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
                except:
                    revenue = 0
                
                data.append({
                    'id': str(course.uuid),
                    'title': course.title,
                    'status': course.status,
                    'course_type': course.course_type,  # Add course_type instead of price
                    'total_enrolled': course.total_enrolled or 0,
                    'average_rating': float(course.average_rating or 0),
                    'total_revenue': float(revenue),
                    'created_at': course.created_at.isoformat(),
                    'thumbnail': course.thumbnail.url if course.thumbnail else None
                })
            
            return Response(data)
        except Exception as e:
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
        course = self.get_object()

        # Validate course has content
        if not course.sections.exists():
            return Response(
                {'error': 'Course must have at least one section'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check grade weights
        from assessments.models import Quiz, Assignment

        quiz_weights = Quiz.objects.filter(course=course).aggregate(
            total=Sum('weight')
        )['total'] or Decimal('0')

        assignment_weights = Assignment.objects.filter(course=course).aggregate(
            total=Sum('weight')
        )['total'] or Decimal('0')

        total_weight = quiz_weights + assignment_weights

        if total_weight != 100:
            return Response(
                {
                    'error': 'Course total grade weight must be exactly 100%',
                    'current_weight': float(total_weight),
                    'missing_weight': float(100 - total_weight)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if course is in draft or rejected status
        if course.status not in ['draft', 'rejected']:
            return Response(
                {'error': 'Only draft or rejected courses can apply for publishing'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update course status to pending review and clear rejection data
        course.status = 'pending_review'
        course.rejection_reason = None
        course.rejection_date = None
        course.rejected_by = None
        course.save()

        # Send notification to all admin users about course submission
        notification_result = NotificationService.create_course_submission_notification(course=course)

        return Response({
            'status': 'pending_review',
            'message': 'Course submitted for admin review. You will be notified once it is approved.'
        })

    
    
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
    
    @action(detail=True, methods=['post'], url_path='delete-course')
    def delete_course(self, request, pk=None):
        """Delete a course with confirmation"""
        try:
            course = self.get_object()
            
            # Debug logging
            print(f"Delete course request received for course: {course.title}")
            print(f"Request data: {request.data}")
            
            # Get confirmation string from request
            confirmation = request.data.get('confirmation', '')
            expected_confirmation = f"{request.user.email}/{course.title}"
            
            print(f"Expected confirmation: {expected_confirmation}")
            print(f"Received confirmation: {confirmation}")
            
            if confirmation != expected_confirmation:
                return Response({
                    'error': f'Confirmation failed. Please type "{expected_confirmation}" to confirm deletion.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in delete_course: {str(e)}")
            return Response({
                'error': f'An error occurred: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Check if course has enrollments
        enrollment_count = Enrollment.objects.filter(course=course).count()
        if enrollment_count > 0:
            return Response({
                'error': f'Cannot delete course with {enrollment_count} enrolled students. Please contact support for assistance.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Store course title for response
        course_title = course.title
        
        # Delete the course (this will cascade delete related objects)
        course.delete()
        
        print(f"Course {course_title} successfully deleted")
        
        return Response({
            'message': f'Course "{course_title}" has been permanently deleted.'
        }, status=status.HTTP_200_OK)
    

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

    def update(self, request, *args, **kwargs):
        """Override update to prevent editing published courses"""
        course = self.get_object()

        if course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit published courses. Please unpublish the course first.',
                    'status': course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing published courses"""
        course = self.get_object()

        if course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit published courses. Please unpublish the course first.',
                    'status': course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Unpublish a course - instructor only"""
        course = self.get_object()

        if course.status != 'published':
            return Response(
                {'error': 'Only published courses can be unpublished'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update course status
        course.status = 'draft'
        course.published_date = None
        course.save()

        return Response({
            'message': f'Course "{course.title}" has been unpublished',
            'course_id': str(course.uuid),
            'status': course.status
        })

# Section and Lecture ViewSets
class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsInstructor]
    lookup_field = 'uuid'

    def get_queryset(self):
        course_uuid = self.kwargs.get('course_uuid')
        if course_uuid:
            return Section.objects.filter(
                course__uuid=course_uuid,
                course__instructor=self.request.user
            )
        else:
            return Section.objects.filter(
                course__instructor=self.request.user
            )
    
    def perform_create(self, serializer):
        course_uuid = self.kwargs.get('course_uuid')
        course = get_object_or_404(Course, uuid=course_uuid, instructor=self.request.user)

        if course.status == 'published':
            raise ValidationError('Cannot add sections to published courses. Please unpublish the course first.')

        # Auto-assign the next available order (count-based to avoid gaps)
        current_count = Section.objects.filter(course=course).count()
        next_order = current_count + 1

        serializer.save(course=course, order=next_order)


    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_sections(self, request, course_uuid=None):
        """Reorder sections within a course"""
        try:
            # Get course_uuid from kwargs or parameter
            course_uuid = course_uuid or self.kwargs.get('course_uuid')
            course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

            section_orders = request.data.get('section_orders', [])

            # Use transaction to avoid unique constraint violations
            from django.db import transaction

            with transaction.atomic():
                # First, collect all sections to update
                sections_to_update = []
                for item in section_orders:
                    section_uuid = item.get('uuid')
                    new_order = item.get('order')

                    try:
                        section = Section.objects.get(
                            uuid=section_uuid,
                            course=course
                        )
                        sections_to_update.append((section, new_order))
                    except Section.DoesNotExist:
                        continue

                # Step 1: Set all sections to temporary high order values (1000+)
                for i, (section, new_order) in enumerate(sections_to_update):
                    section.order = 1000 + i  # Temporary high value
                    section.save()

                # Step 2: Now set the final order values
                for section, new_order in sections_to_update:
                    section.order = new_order
                    section.save()

            return Response({'message': 'Sections reordered successfully'})

        except Exception as e:
            return Response(
                {'error': f'Failed to reorder sections: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


    def update(self, request, *args, **kwargs):
        """Override update to prevent editing sections of published courses"""
        section = self.get_object()

        if section.course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit sections of published courses. Please unpublish the course first.',
                    'course_status': section.course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing sections of published courses"""
        section = self.get_object()

        if section.course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit sections of published courses. Please unpublish the course first.',
                    'course_status': section.course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """Override destroy to prevent deleting sections of published courses"""
        if instance.course.status == 'published':
            raise ValidationError('Cannot delete sections of published courses. Please unpublish the course first.')

        """Delete section and reorder all remaining sections in the course sequentially"""
        course = instance.course

        # Delete the instance
        super().perform_destroy(instance)

        # Reorder ALL remaining sections in the course to ensure sequential numbering (1, 2, 3, ...)
        remaining_sections = Section.objects.filter(course=course).order_by('order')

        # Update order to be sequential starting from 1
        for i, section in enumerate(remaining_sections, 1):
            if section.order != i:
                section.order = i
                section.save()

class LectureViewSet(viewsets.ModelViewSet):
    serializer_class = LectureSerializer
    permission_classes = [IsInstructor]
    lookup_field = 'uuid'
    
    def get_queryset(self):
        section_uuid = self.kwargs.get('section_uuid')
        if section_uuid:
            return Lecture.objects.filter(
                section__uuid=section_uuid,
                section__course__instructor=self.request.user
            )
        else:
            return Lecture.objects.filter(
                section__course__instructor=self.request.user
            )
    
    def perform_create(self, serializer):
        section_uuid = self.kwargs.get('section_uuid')
        section = get_object_or_404(
            Section,
            uuid=section_uuid,
            course__instructor=self.request.user
        )

        if section.course.status == 'published':
            raise ValidationError('Cannot add lectures to published courses. Please unpublish the course first.')

        # Auto-assign the next available order (count-based to avoid gaps)
        current_count = Lecture.objects.filter(section=section).count()
        next_order = current_count + 1

        lecture = serializer.save(section=section, order=next_order)

        # If this is a video lecture, create the video content
        if lecture.content_type == 'video':
            self._create_video_content(lecture)

        # If this is a quiz lecture, create the quiz and questions
        if lecture.content_type == 'quiz':
            self._create_quiz_data(lecture)

        # If this is an assignment lecture, create the assignment
        if lecture.content_type == 'assignment':
            self._create_assignment_data(lecture)

        # If this is a reading lecture, create the reading document
        if lecture.content_type == 'reading':
            self._create_reading_data(lecture)

    def perform_update(self, serializer):
        lecture = serializer.save()

        # Handle video content updates
        if lecture.content_type == 'video':
            self._update_video_content(lecture)

        # Handle quiz updates
        if lecture.content_type == 'quiz':
            self._update_quiz_data(lecture)

        # Handle assignment updates
        if lecture.content_type == 'assignment':
            self._update_assignment_data(lecture)

        # Handle reading updates
        if lecture.content_type == 'reading':
            self._update_reading_data(lecture)

    def perform_destroy(self, instance):
        """Delete lecture and reorder all remaining lectures in the section sequentially"""
        if instance.section.course.status == 'published':
            raise ValidationError('Cannot delete lectures of published courses. Please unpublish the course first.')

        section = instance.section

        # Delete the instance
        super().perform_destroy(instance)

        # Reorder ALL remaining lectures in the section to ensure sequential numbering (1, 2, 3, ...)
        remaining_lectures = Lecture.objects.filter(section=section).order_by('order')

        # Update order to be sequential starting from 1
        for i, lecture in enumerate(remaining_lectures, 1):
            if lecture.order != i:
                lecture.order = i
                lecture.save()


    def _update_quiz_data(self, lecture):
        """Update quiz data - for now, we'll recreate it"""
        from assessments.models import Quiz

        # Delete existing quiz if it exists
        try:
            existing_quiz = Quiz.objects.get(lecture=lecture)
            existing_quiz.delete()
        except Quiz.DoesNotExist:
            pass

        # Create new quiz with updated data
        self._create_quiz_data(lecture)

    def _update_assignment_data(self, lecture):
        """Update assignment data - preserve existing attachment if no new one provided"""
        from assessments.models import Assignment

        # Get existing assignment if it exists
        existing_assignment = None
        try:
            existing_assignment = Assignment.objects.get(lecture=lecture)
        except Assignment.DoesNotExist:
            pass

        # If we have an existing assignment, preserve its file if no new file is uploaded
        if existing_assignment:
            existing_attachment = existing_assignment.attachment
            existing_assignment.delete()

            # Create new assignment with updated data
            self._create_assignment_data(lecture)

            # If no new attachment was provided, restore the old one
            request_data = self.request.data
            attachment_file = request_data.get('attachment') or self.request.FILES.get('attachment')
            if not attachment_file and existing_attachment:
                updated_assignment = Assignment.objects.get(lecture=lecture)
                updated_assignment.attachment = existing_attachment
                updated_assignment.save()
        else:
            # Create new assignment with updated data
            self._create_assignment_data(lecture)

    def _create_quiz_data(self, lecture):
        """Create quiz, questions and options from lecture data"""
        request_data = self.request.data

        # Create Quiz
        quiz_settings = request_data.get('quiz_settings', {})
        # Handle JSON string from FormData
        if isinstance(quiz_settings, str):
            import json
            quiz_settings = json.loads(quiz_settings)
        quiz = Quiz.objects.create(
            course=lecture.section.course,
            section=lecture.section,
            lecture=lecture,
            title=lecture.title,
            description=lecture.description or '',
            passing_score=quiz_settings.get('passing_score', 60),
            time_limit=quiz_settings.get('time_limit'),
            max_attempts=quiz_settings.get('max_attempts', 3),
            weight=quiz_settings.get('weight', 0),
            randomize_questions=quiz_settings.get('randomize_questions', False),
            show_answers=quiz_settings.get('show_answers', True)
        )

        # Create Questions and Options
        questions_data = request_data.get('questions', [])
        # Handle JSON string from FormData
        if isinstance(questions_data, str):
            import json
            questions_data = json.loads(questions_data)
        for order, question_data in enumerate(questions_data):
            question = Question.objects.create(
                quiz=quiz,
                question_text=question_data.get('question_text', ''),
                question_type=question_data.get('question_type', 'multiple_choice'),
                order=order,
                points=question_data.get('points', 1),
                explanation=question_data.get('explanation', '')
            )

            # Create Options
            options_data = question_data.get('options', [])
            for option_order, option_data in enumerate(options_data):
                QuestionOption.objects.create(
                    question=question,
                    option_text=option_data.get('option_text', ''),
                    is_correct=option_data.get('is_correct', False),
                    order=option_data.get('order', option_order)
                )

    def _create_assignment_data(self, lecture):
        """Create assignment from lecture data"""
        request_data = self.request.data
        assignment_settings = request_data.get('assignment_settings', {})
        # Handle JSON string from FormData
        if isinstance(assignment_settings, str):
            import json
            assignment_settings = json.loads(assignment_settings)

        # Parse due date if provided
        due_date = None
        if assignment_settings.get('due_date'):
            try:
                from datetime import datetime
                from django.utils import timezone
                # Parse the datetime from frontend (which sends local time)
                naive_datetime = datetime.fromisoformat(assignment_settings['due_date'].replace('T', ' '))
                # Convert from local timezone to UTC for storage
                due_date = timezone.make_aware(naive_datetime, timezone=timezone.get_current_timezone())
            except (ValueError, AttributeError):
                pass

        # Handle attachment file
        attachment_file = request_data.get('attachment') or self.request.FILES.get('attachment')

        # Create Assignment record
        Assignment.objects.create(
            course=lecture.section.course,
            section=lecture.section,
            lecture=lecture,
            title=lecture.title,
            description=lecture.description or '',
            instructions=assignment_settings.get('instructions', ''),
            max_points=assignment_settings.get('max_points', 100),
            passing_score=assignment_settings.get('passing_score', 60),
            weight=assignment_settings.get('weight', 0),
            due_date=due_date,
            attachment=attachment_file,
            allow_late_submission=assignment_settings.get('allow_late_submission', True),
        )

    def _create_video_content(self, lecture):
        """Create video content and subtitles for video lectures"""
        from content.models import VideoContent, Subtitle

        # Get video data
        video_file = self.request.FILES.get('video_file')
        video_url = self.request.data.get('video_url', '')

        # Only create VideoContent if we have video_file or video_url
        if video_file or video_url:
            # Create VideoContent record
            video_content = VideoContent.objects.create(
                lecture=lecture,
                video_file=video_file,
                video_url=video_url,
            )

            # Handle subtitle file if provided
            subtitle_file = self.request.FILES.get('subtitle_file')
            if subtitle_file:
                # Default to English for now, could be made configurable
                Subtitle.objects.create(
                    video=video_content,
                    language='en',
                    file=subtitle_file,
                    is_auto_generated=False
                )

    def _update_video_content(self, lecture):
        """Update video content for video lectures"""
        from content.models import VideoContent, Subtitle

        # Get existing video content if it exists
        try:
            video_content = VideoContent.objects.get(lecture=lecture)
        except VideoContent.DoesNotExist:
            video_content = None

        # Get video data
        video_file = self.request.FILES.get('video_file')
        video_url = self.request.data.get('video_url', '')

        # Only update/create if we have video data
        if video_file or video_url:
            if video_content:
                # Update existing video content
                if video_file:
                    video_content.video_file = video_file
                video_content.video_url = video_url
                video_content.save()
            else:
                # Create new video content
                video_content = VideoContent.objects.create(
                    lecture=lecture,
                    video_file=video_file,
                    video_url=video_url,
                )

            # Handle subtitle file if provided
            subtitle_file = self.request.FILES.get('subtitle_file')
            if subtitle_file:
                # Remove existing subtitle and create new one
                Subtitle.objects.filter(video=video_content, language='en').delete()
                Subtitle.objects.create(
                    video=video_content,
                    language='en',
                    file=subtitle_file,
                    is_auto_generated=False
                )

    def _create_reading_data(self, lecture):
        """Create reading from lecture data"""
        from content.models import Reading
        import os

        # Get content and file data
        content = self.request.data.get('article_content', '')
        reading_file = self.request.FILES.get('reading_file')
        markdown_file = self.request.FILES.get('markdown_file')
        pdf_file = self.request.FILES.get('pdf_file')

        # Determine which file to use
        file_to_upload = reading_file or markdown_file or pdf_file

        # Validate file if provided
        if file_to_upload:
            file_ext = os.path.splitext(file_to_upload.name)[1].lower()
            allowed_extensions = ['.pdf', '.md', '.markdown']

            if file_ext not in allowed_extensions:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(f'Invalid file type. Only PDF and Markdown files are allowed.')

        # Create Reading record (either with content or file or both)
        if content or file_to_upload:
            Reading.objects.create(
                lecture=lecture,
                content=content,
                file=file_to_upload,
                is_downloadable=True
            )

    def _update_reading_data(self, lecture):
        """Update reading for reading lectures"""
        from content.models import Reading
        import os

        # Get existing reading if it exists
        existing_reading = None
        try:
            existing_reading = Reading.objects.get(lecture=lecture)
        except Reading.DoesNotExist:
            pass

        # Get content and file data
        content = self.request.data.get('article_content', '')
        reading_file = self.request.FILES.get('reading_file')
        markdown_file = self.request.FILES.get('markdown_file')
        pdf_file = self.request.FILES.get('pdf_file')

        # Determine which file to use
        file_to_upload = reading_file or markdown_file or pdf_file

        # Validate file if provided
        if file_to_upload:
            file_ext = os.path.splitext(file_to_upload.name)[1].lower()
            allowed_extensions = ['.pdf', '.md', '.markdown']

            if file_ext not in allowed_extensions:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(f'Invalid file type. Only PDF and Markdown files are allowed.')

        if existing_reading:
            # Update existing reading
            existing_reading.content = content
            if file_to_upload:
                existing_reading.file = file_to_upload
            existing_reading.save()
        else:
            # Create new reading if content or file provided
            if content or file_to_upload:
                Reading.objects.create(
                    lecture=lecture,
                    content=content,
                    file=file_to_upload,
                    is_downloadable=True
                )

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_lectures(self, request, section_uuid=None):
        """Reorder lectures within a section"""
        try:
            # Get section_uuid from kwargs or parameter
            section_uuid = section_uuid or self.kwargs.get('section_uuid')
            section = get_object_or_404(
                Section,
                uuid=section_uuid,
                course__instructor=request.user
            )

            lecture_orders = request.data.get('lecture_orders', [])

            # Use transaction to avoid unique constraint violations
            from django.db import transaction

            with transaction.atomic():
                # First, collect all lectures to update
                lectures_to_update = []
                for item in lecture_orders:
                    lecture_uuid = item.get('uuid')
                    new_order = item.get('order')

                    try:
                        lecture = Lecture.objects.get(
                            uuid=lecture_uuid,
                            section=section
                        )
                        lectures_to_update.append((lecture, new_order))
                    except Lecture.DoesNotExist:
                        continue

                # Step 1: Set all lectures to temporary high order values (1000+)
                for i, (lecture, new_order) in enumerate(lectures_to_update):
                    lecture.order = 1000 + i  # Temporary high value
                    lecture.save()

                # Step 2: Now set the final order values
                for lecture, new_order in lectures_to_update:
                    lecture.order = new_order
                    lecture.save()

            return Response({'message': 'Lectures reordered successfully'})

        except Exception as e:
            return Response(
                {'error': f'Failed to reorder lectures: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


    def update(self, request, *args, **kwargs):
        """Override update to prevent editing lectures of published courses"""
        lecture = self.get_object()

        if lecture.section.course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit lectures of published courses. Please unpublish the course first.',
                    'course_status': lecture.section.course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing lectures of published courses"""
        lecture = self.get_object()

        if lecture.section.course.status == 'published':
            return Response(
                {
                    'error': 'Cannot edit lectures of published courses. Please unpublish the course first.',
                    'course_status': lecture.section.course.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().partial_update(request, *args, **kwargs)


# Admin API endpoints
@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_pending_courses(request):
    """Get all courses pending admin review"""
    try:
        pending_courses = Course.objects.filter(
            status='pending_review'
        ).select_related('instructor').order_by('-updated_at')

        data = []
        for course in pending_courses:
            # Calculate grade weights
            quiz_weights = Quiz.objects.filter(course=course).aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')

            assignment_weights = Assignment.objects.filter(course=course).aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')

            total_weight = quiz_weights + assignment_weights

            data.append({
                'id': str(course.uuid),
                'title': course.title,
                'instructor': {
                    'id': str(course.instructor.uuid),
                    'name': f"{course.instructor.first_name} {course.instructor.last_name}".strip() or course.instructor.email,
                    'email': course.instructor.email
                },
                'category': course.category.name if course.category else 'Uncategorized',
                'course_type': course.course_type,
                'submitted_date': course.updated_at.isoformat(),
                'sections_count': course.sections.count(),
                'lectures_count': sum(section.lectures.count() for section in course.sections.all()),
                'total_weight': float(total_weight),
                'description': course.description,
                'thumbnail': course.thumbnail.url if course.thumbnail else None,
                'duration_hours': float(course.duration_hours) if course.duration_hours else 0
            })

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to fetch pending courses: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_approve_course(request, course_id):
    """Approve a course for publishing"""
    try:
        course = get_object_or_404(Course, uuid=course_id, status='pending_review')

        # Update course status and clear any previous rejection data
        course.status = 'published'
        course.published_date = timezone.now()
        course.rejection_reason = None
        course.rejection_date = None
        course.rejected_by = None
        course.save()

        # Send notification to instructor about approval
        notification_result = NotificationService.create_course_approval_notification(
            course=course,
            approved_by=request.user
        )

        return Response({
            'message': f'Course "{course.title}" has been approved and published',
            'course_id': str(course.uuid),
            'published_date': course.published_date.isoformat()
        })

    except Course.DoesNotExist:
        return Response(
            {'error': 'Course not found or not pending review'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to approve course: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAdmin])
def admin_reject_course(request, course_id):
    """Reject a course publishing request"""
    try:
        course = get_object_or_404(Course, uuid=course_id, status='pending_review')
        reason = request.data.get('reason', '')

        if not reason.strip():
            return Response(
                {'error': 'Rejection reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update course status and rejection fields
        course.status = 'rejected'
        course.rejection_reason = reason.strip()
        course.rejection_date = timezone.now()
        course.rejected_by = request.user
        course.save()

        # Send notification to instructor with rejection reason
        notification_result = NotificationService.create_course_rejection_notification(
            course=course,
            rejection_reason=reason.strip(),
            rejected_by=request.user
        )

        return Response({
            'message': f'Course "{course.title}" has been rejected',
            'course_id': str(course.uuid),
            'reason': reason,
            'rejected_by': request.user.get_full_name() or request.user.email,
            'rejection_date': course.rejection_date.isoformat()
        })

    except Course.DoesNotExist:
        return Response(
            {'error': 'Course not found or not pending review'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to reject course: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_courses(request):
    """Get all courses for admin dashboard"""
    try:
        # Get all courses regardless of status
        all_courses = Course.objects.select_related('instructor').order_by('-created_at')

        data = []
        for course in all_courses:
            # Calculate grade weights
            quiz_weights = Quiz.objects.filter(course=course).aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')

            assignment_weights = Assignment.objects.filter(course=course).aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')

            total_weight = quiz_weights + assignment_weights

            data.append({
                'id': str(course.uuid),
                'title': course.title,
                'instructor': {
                    'id': str(course.instructor.uuid),
                    'name': f"{course.instructor.first_name} {course.instructor.last_name}".strip() or course.instructor.email,
                    'email': course.instructor.email
                },
                'category': course.category.name if course.category else 'Uncategorized',
                'course_type': course.course_type,
                'status': course.status,
                'created_date': course.created_at.isoformat(),
                'published_date': course.published_date.isoformat() if course.published_date else None,
                'sections_count': course.sections.count(),
                'lectures_count': sum(section.lectures.count() for section in course.sections.all()),
                'total_weight': float(total_weight),
                'total_enrolled': course.total_enrolled,
                'average_rating': float(course.average_rating) if course.average_rating else 0,
                'description': course.description,
                'thumbnail': course.thumbnail.url if course.thumbnail else None,
                'duration_hours': float(course.duration_hours) if course.duration_hours else 0
            })

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to fetch all courses: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_users(request):
    """Get all users for admin dashboard"""
    try:
        from accounts.models import User

        users = User.objects.all().order_by('-date_joined')
        data = []

        for user in users:
            try:
                # Basic user data
                user_data = {
                    'id': str(user.uuid),
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split('@')[0],
                    'email': user.email,
                    'user_type': user.user_type,
                    'join_date': user.date_joined.isoformat(),
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'is_active': user.is_active,
                    'status': 'active' if user.is_active else 'inactive',
                    'phone_number': getattr(user, 'phone_number', '') or '',
                    'email_verified': getattr(user, 'email_verified', False),
                    'avatar': f'https://ui-avatars.com/api/?name={user.first_name or "User"}&background=6366F1&color=fff'
                }

                # Add user-type specific data
                if user.user_type == 'student':
                    from enrollments.models import Enrollment
                    enrollments = Enrollment.objects.filter(student=user)
                    user_data.update({
                        'courses_enrolled': enrollments.count(),
                        'completed_courses': enrollments.filter(status='completed').count(),
                        'active_courses': enrollments.filter(status='active').count(),
                    })

                elif user.user_type == 'instructor':
                    from courses.models import Course
                    from enrollments.models import Enrollment
                    instructor_courses = Course.objects.filter(instructor=user)
                    user_data.update({
                        'courses_created': instructor_courses.count(),
                        'published_courses': instructor_courses.filter(status='published').count(),
                        'draft_courses': instructor_courses.filter(status='draft').count(),
                        'students_taught': Enrollment.objects.filter(course__instructor=user).values('student').distinct().count(),
                    })

                else:  # admin users
                    user_data.update({
                        'is_superuser': getattr(user, 'is_superuser', False),
                        'is_admin': getattr(user, 'is_admin', False),
                    })

                data.append(user_data)

            except Exception as user_error:
                # Skip users that cause errors but continue processing others
                continue

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get users: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Notification API endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_notifications(request):
    """Get notifications for the current user"""
    try:
        notifications = NotificationService.get_user_notifications(
            user=request.user,
            limit=int(request.GET.get('limit', 20)),
            include_read=request.GET.get('include_read', 'true').lower() == 'true'
        )

        data = []
        for notification in notifications:
            data.append({
                'id': notification.id,
                'type': notification.notification_type,
                'title': notification.title,
                'message': notification.message,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat(),
                'read_at': notification.read_at.isoformat() if notification.read_at else None,
                'action_url': notification.action_url,
            })

        return Response(data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get notifications: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unread_notification_count(request):
    """Get count of unread notifications for the current user"""
    try:
        count = NotificationService.get_unread_count(request.user)
        return Response({'unread_count': count})

    except Exception as e:
        return Response(
            {'error': f'Failed to get notification count: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark a notification as read"""
    try:
        notification = NotificationService.mark_as_read(notification_id, request.user)
        if notification:
            return Response({'message': 'Notification marked as read'})
        else:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    except Exception as e:
        return Response(
            {'error': f'Failed to mark notification as read: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Assignment Management for Instructors
@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_assignments(request):
    """Get all assignments for the instructor's courses"""
    try:
        from assessments.models import Assignment, AssignmentSubmission

        # Get all assignments from instructor's courses
        assignments = Assignment.objects.filter(
            course__instructor=request.user,
            is_active=True
        ).select_related('course', 'lecture').prefetch_related('submissions')

        assignment_data = []
        for assignment in assignments:
            total_submissions = assignment.submissions.count()
            graded_submissions = assignment.submissions.filter(grade__isnull=False).count()

            assignment_data.append({
                'id': str(assignment.uuid),
                'title': assignment.title,
                'description': assignment.description,
                'instructions': assignment.instructions,
                'max_points': assignment.max_points,
                'passing_score': assignment.passing_score,
                'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
                'course_title': assignment.course.title,
                'course_id': str(assignment.course.uuid),
                'lecture_title': assignment.lecture.title if assignment.lecture else None,
                'total_submissions': total_submissions,
                'graded_submissions': graded_submissions,
                'pending_submissions': total_submissions - graded_submissions,
                'created_at': assignment.created_at.isoformat(),
            })

        return Response(assignment_data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get assignments: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_assignment_submissions(request, assignment_uuid):
    """Get all submissions for a specific assignment"""
    try:
        from assessments.models import Assignment, AssignmentSubmission

        assignment = get_object_or_404(Assignment, uuid=assignment_uuid, course__instructor=request.user)

        submissions = AssignmentSubmission.objects.filter(
            assignment=assignment
        ).select_related('student', 'graded_by').order_by('-submitted_at')

        submission_data = []
        for submission in submissions:
            submission_data.append({
                'id': str(submission.uuid),
                'student_id': str(submission.student.uuid),
                'student_name': f"{submission.student.first_name} {submission.student.last_name}",
                'student_email': submission.student.email,
                'submission_text': submission.submission_text,
                'has_file': bool(submission.submission_file),
                'original_filename': submission.original_filename,
                'submitted_at': submission.submitted_at.isoformat(),
                'is_late': submission.is_late,
                'grade': float(submission.grade) if submission.grade else None,
                'feedback': submission.feedback,
                'graded_by': submission.graded_by.get_full_name() if submission.graded_by else None,
                'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
            })

        return Response(submission_data)

    except Exception as e:
        return Response(
            {'error': f'Failed to get submissions: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsInstructor])
def grade_assignment_submission(request, submission_uuid):
    """Grade an assignment submission"""
    try:
        from assessments.models import AssignmentSubmission
        from django.utils import timezone

        print(f"Grading submission {submission_uuid} by instructor {request.user}")
        print(f"Request data: {request.data}")

        submission = get_object_or_404(
            AssignmentSubmission,
            uuid=submission_uuid,
            assignment__course__instructor=request.user
        )

        print(f"Found submission: {submission.id} for assignment: {submission.assignment.title}")

        grade = request.data.get('grade')
        feedback = request.data.get('feedback', '')

        if grade is None:
            return Response(
                {'error': 'Grade is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            grade = float(grade)
        except ValueError:
            return Response(
                {'error': 'Grade must be a valid number'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if grade < 0 or grade > submission.assignment.max_points:
            return Response(
                {'error': f'Grade must be between 0 and {submission.assignment.max_points}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update submission
        print(f"Updating submission with grade: {grade}, feedback: {feedback[:50]}...")
        submission.grade = grade
        submission.feedback = feedback.strip()
        submission.graded_by = request.user
        submission.graded_at = timezone.now()

        try:
            # Use direct database update to bypass model validation for grading
            from assessments.models import AssignmentSubmission
            updated_count = AssignmentSubmission.objects.filter(uuid=submission_uuid).update(
                grade=grade,
                feedback=feedback.strip(),
                graded_by=request.user,
                graded_at=timezone.now()
            )

            print(f"Database update affected {updated_count} rows")

            # Refresh the object to get updated values
            submission.refresh_from_db()
            print(f"Submission after refresh - Grade: {submission.grade}, Feedback: {submission.feedback}")
            print(f"Submission saved successfully")
        except Exception as save_error:
            print(f"Error saving submission: {str(save_error)}")
            print(f"Error type: {type(save_error)}")
            raise save_error

        # Create notification for student
        try:
            percentage = int((grade / submission.assignment.max_points) * 100)
            notification = Notification.objects.create(
                recipient=submission.student,
                notification_type='assignment_graded',
                title=f'Assignment "{submission.assignment.title}" has been graded',
                message=f'Your assignment "{submission.assignment.title}" has been graded. You received {grade}/{submission.assignment.max_points} points ({percentage}%).',
                action_url=f'/courses/{submission.assignment.course.uuid}/learn'
            )
        except Exception as e:
            print(f"Error creating grading notification: {str(e)}")
            # Don't fail the grading if notification fails

        return Response({
            'message': 'Assignment graded successfully',
            'submission': {
                'id': str(submission.uuid),
                'grade': float(submission.grade),
                'feedback': submission.feedback,
                'graded_by': submission.graded_by.get_full_name(),
                'graded_at': submission.graded_at.isoformat(),
            }
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to grade submission: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_course_gradebook(request, course_uuid):
    """Get gradebook for all students in instructor's course"""
    try:
        from assessments.services import GradeCalculationService
        from enrollments.models import Enrollment

        course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

        enrollments = Enrollment.objects.filter(course=course, status='active').select_related('student')
        gradebook_data = []

        for enrollment in enrollments:
            grade_data = GradeCalculationService.calculate_student_course_grade(
                enrollment.student, course
            )

            student_data = {
                'student_id': str(enrollment.student.uuid),
                'student_name': f"{enrollment.student.first_name} {enrollment.student.last_name}",
                'student_email': enrollment.student.email,
                'enrollment_date': enrollment.enrolled_date.isoformat(),
                'progress_percentage': enrollment.progress_percentage,
            }

            if grade_data:
                student_data.update(grade_data)
            else:
                student_data.update({
                    'final_grade': 0,
                    'letter_grade': 'F',
                    'components': [],
                    'is_passing': False
                })

            gradebook_data.append(student_data)

        # Calculate course statistics
        course_stats = GradeCalculationService.calculate_course_statistics(course)

        return Response({
            'course': {
                'id': str(course.uuid),
                'title': course.title,
                'instructor': f"{course.instructor.first_name} {course.instructor.last_name}",
            },
            'students': gradebook_data,
            'statistics': course_stats
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get gradebook: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsStudent])
def student_gradebook(request):
    """Get student's gradebook across all enrolled courses"""
    try:
        from assessments.services import GradeCalculationService

        gradebook = GradeCalculationService.get_student_gradebook(request.user)

        return Response({
            'student': {
                'id': str(request.user.uuid),
                'name': f"{request.user.first_name} {request.user.last_name}",
                'email': request.user.email,
            },
            'courses': gradebook
        })

    except Exception as e:
        return Response(
            {'error': f'Failed to get student gradebook: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )