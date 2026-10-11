# courses/views.py
#
# What is left here is served from the courses URLs for historical reasons and
# moves to its own slice later: the instructor dashboard and admin user list
# (insights) and assignment grading / gradebooks (assessments).
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsInstructor, IsStudent
from apps.assessments.models import Assignment, Quiz
from apps.billing.models import InstructorEarning
from apps.core.events import assignment_graded, emit
from apps.learning.models import Enrollment

from .models import Course


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


# Section and Lecture ViewSets


# Admin API endpoints


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_users(request):
    """Get all users for admin dashboard"""
    try:
        from apps.accounts.models import User

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
                    from apps.learning.models import Enrollment
                    enrollments = Enrollment.objects.filter(student=user)
                    user_data.update({
                        'courses_enrolled': enrollments.count(),
                        'completed_courses': enrollments.filter(status='completed').count(),
                        'active_courses': enrollments.filter(status='active').count(),
                    })

                elif user.user_type == 'instructor':
                    from apps.courses.models import Course
                    from apps.learning.models import Enrollment
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


# Assignment Management for Instructors
@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_assignments(request):
    """Get all assignments for the instructor's courses"""
    try:
        from apps.assessments.models import Assignment, AssignmentSubmission

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
        from apps.assessments.models import Assignment, AssignmentSubmission

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
        from apps.assessments.models import AssignmentSubmission
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
            from apps.assessments.models import AssignmentSubmission
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

        # tell the student (best effort - never fails the grading)
        emit(assignment_graded, submission=submission, grade=grade, graded_by=request.user)

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
        from apps.assessments.services import GradeCalculationService
        from apps.learning.models import Enrollment

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
        from apps.assessments.services import GradeCalculationService

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