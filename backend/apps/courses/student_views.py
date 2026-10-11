# courses/student_views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Count, Avg, Sum, Q, F, Exists, OuterRef
from django.utils import timezone
from datetime import datetime, timedelta, date
from decimal import Decimal

from apps.accounts.permissions import IsStudent

from .models import Course, Section, Lecture
from apps.learning.models import Enrollment, LectureProgress, CourseBookmark
from apps.certificates.models import Certificate
from apps.accounts.models import User, StudentProfile
from apps.assessments.models import QuizAttempt, AssignmentSubmission, Quiz, Question, QuestionResponse, QuestionOption, Assignment


@api_view(['GET'])
@permission_classes([AllowAny])
def all_courses(request):
    """Get all available courses for students to explore"""

    # Get filter parameters
    category = request.GET.get('category', 'all')
    level = request.GET.get('level', 'all')
    course_type = request.GET.get('type', 'all')
    search = request.GET.get('search', '')
    sort_by = request.GET.get('sort', 'popular')

    # Base queryset - only published courses
    courses = Course.objects.filter(status='published')

    # Check subscription status for enrollment permissions (but show all courses)
    has_plus_access = False
    if request.user.is_authenticated and request.user.user_type == 'student':
        has_plus_access = request.user.has_plus_access
    
    # Apply filters
    if category != 'all':
        courses = courses.filter(category__slug=category)
    
    if level != 'all':
        courses = courses.filter(level=level)
    
    if course_type != 'all':
        courses = courses.filter(course_type=course_type)
    
    if search:
        # Sanitize search input for security
        from apps.core.utils import sanitize_search_query
        search = sanitize_search_query(search)
        if search:  # Only search if we have valid input after sanitization
            courses = courses.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(instructor__first_name__icontains=search) |
                Q(instructor__last_name__icontains=search)
            )
    
    # Apply sorting
    if sort_by == 'popular':
        courses = courses.order_by('-total_enrolled')
    elif sort_by == 'rating':
        courses = courses.order_by('-average_rating')
    elif sort_by == 'newest':
        courses = courses.order_by('-created_at')
    
    # Annotate with additional data
    if request.user.is_authenticated:
        courses = courses.annotate(
            is_enrolled=Exists(
                Enrollment.objects.filter(
                    course=OuterRef('pk'),
                    student=request.user
                )
            ),
            is_bookmarked=Exists(
                CourseBookmark.objects.filter(
                    course=OuterRef('pk'),
                    student=request.user
                )
            )
        )
    
    # Serialize data
    course_data = []

    for course in courses[:20]:  # Limit to 20 for performance
        modules_count = course.sections.count()
        total_duration = 0
        for section in course.sections.all():
            for lecture in section.lectures.all():
                if lecture.content_type == 'video':
                    try:
                        from apps.content.models import VideoContent
                        video_content = VideoContent.objects.get(lecture=lecture)
                        total_duration += video_content.duration
                    except VideoContent.DoesNotExist:
                        pass
        total_duration = total_duration / 3600  # Convert to hours
        
        # Determine if user can enroll in this course
        can_enroll = True
        enrollment_message = ""

        if request.user.is_authenticated and request.user.user_type == 'student':
            # Check if already enrolled
            is_enrolled = getattr(course, 'is_enrolled', False)

            if is_enrolled:
                can_enroll = False
                enrollment_message = "Already enrolled"
            elif course.course_type == 'coursera_plus' and not has_plus_access:
                can_enroll = False
                enrollment_message = "Plus subscription required"

        # Get progress if enrolled
        progress_percentage = 0
        if request.user.is_authenticated and getattr(course, 'is_enrolled', False):
            try:
                enrollment = Enrollment.objects.get(course=course, student=request.user)
                progress_percentage = float(enrollment.progress_percentage)
            except Enrollment.DoesNotExist:
                pass

        course_data.append({
            'id': str(course.uuid),
            'title': course.title,
            'instructor': f"{course.instructor.first_name} {course.instructor.last_name}",
            'instructor_id': str(course.instructor.uuid),
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'rating': float(course.average_rating),
            'students': course.total_enrolled,
            'duration': f"{int(total_duration)} hours",
            'level': course.level,
            'category': course.category.name if course.category else 'General',
            'course_type': course.course_type,
            'modules': modules_count,
            'description': course.description[:200] + '...' if len(course.description) > 200 else course.description,
            'is_enrolled': getattr(course, 'is_enrolled', False),
            'is_bookmarked': getattr(course, 'is_bookmarked', False),
            'can_enroll': can_enroll,
            'enrollment_message': enrollment_message,
            'progress': progress_percentage
        })

    return Response(course_data)

@api_view(['GET'])
@permission_classes([IsStudent])
def course_learn_view(request, course_uuid):
    """Get course learning interface with sections, lectures, and progress"""

    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    student = request.user

    # Check if student is enrolled
    try:
        enrollment = Enrollment.objects.get(course=course, student=student, status='active')
    except Enrollment.DoesNotExist:
        return Response(
            {'error': 'You must be enrolled in this course to access learning materials'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get all sections with lectures
    sections = []
    for section in course.sections.all().order_by('order'):
        lectures = []
        for lecture in section.lectures.all().order_by('order'):
            # Get lecture progress
            lecture_progress, created = LectureProgress.objects.get_or_create(
                enrollment=enrollment,
                lecture=lecture,
                defaults={
                    'is_completed': False,
                    'progress_seconds': 0,
                    'last_watched_position': 0,
                    'watch_count': 0
                }
            )

            lecture_data = {
                'id': str(lecture.uuid),
                'title': lecture.title,
                'description': lecture.description,
                'content_type': lecture.content_type,
                'order': lecture.order,
                'is_preview': lecture.is_preview,
                'is_downloadable': lecture.is_downloadable,
                'is_completed': lecture_progress.is_completed,
                'progress_seconds': lecture_progress.progress_seconds,
                'last_watched_position': lecture_progress.last_watched_position,
                'watch_count': lecture_progress.watch_count,
            }

            # Add content-specific data
            if lecture.content_type == 'video':
                try:
                    from apps.content.models import VideoContent
                    video_content = VideoContent.objects.get(lecture=lecture)

                    # Get subtitles
                    subtitles = []
                    for subtitle in video_content.subtitles.all():
                        subtitles.append({
                            'language': subtitle.language,
                            'language_name': subtitle.get_language_display(),
                            'url': subtitle.file.url if subtitle.file else None,
                            'is_auto_generated': subtitle.is_auto_generated
                        })

                    lecture_data.update({
                        'video_type': 'youtube' if video_content.video_url else 'local',
                        'video_file_url': video_content.video_file.url if video_content.video_file else None,
                        'video_url': video_content.video_url if video_content.video_url else None,
                        'duration': video_content.duration,
                        'thumbnail': None,  # VideoContent doesn't have thumbnail field yet
                        'subtitles': subtitles,
                    })
                except VideoContent.DoesNotExist:
                    lecture_data.update({
                        'video_type': 'local',
                        'video_file_url': None,
                        'video_url': None,
                        'duration': 0,
                        'thumbnail': None,
                        'subtitles': [],
                    })

            elif lecture.content_type == 'reading':
                try:
                    from apps.content.models import Reading
                    reading_content = Reading.objects.get(lecture=lecture)
                    lecture_data.update({
                        'content': reading_content.content,
                        'estimated_reading_time': 10,  # Default estimated time in minutes
                        'file_url': reading_content.file.url if reading_content.file else None,
                        'is_downloadable': reading_content.is_downloadable,
                    })
                except Reading.DoesNotExist:
                    lecture_data.update({
                        'content': '',
                        'estimated_reading_time': 0,
                        'file_url': None,
                        'is_downloadable': False,
                    })

            elif lecture.content_type == 'quiz':
                try:
                    quiz = lecture.quiz.first()  # Get the first quiz for this lecture
                    if not quiz:
                        raise Quiz.DoesNotExist("No quiz found for this lecture")

                    # Get student's attempts
                    attempts = QuizAttempt.objects.filter(
                        student=student,
                        quiz=quiz
                    ).order_by('-attempt_number')

                    attempts_count = attempts.count()
                    best_score = 0
                    if attempts.exists():
                        best_score = max(attempt.score or 0 for attempt in attempts)

                    can_attempt = attempts_count < quiz.max_attempts

                    lecture_data.update({
                        'quiz_id': str(quiz.uuid),
                        'max_attempts': quiz.max_attempts,
                        'passing_score': quiz.passing_score,
                        'attempts_taken': attempts_count,
                        'best_score': float(best_score),
                        'passed': best_score >= quiz.passing_score,
                        'can_attempt': can_attempt,
                    })
                except Exception as e:
                    lecture_data.update({
                        'quiz_id': None,
                        'max_attempts': 0,
                        'passing_score': 0,
                        'attempts_taken': 0,
                        'best_score': 0,
                        'passed': False,
                        'can_attempt': False,
                    })

            elif lecture.content_type == 'assignment':
                try:
                    from apps.assessments.models import Assignment, AssignmentSubmission
                    assignment = Assignment.objects.get(lecture=lecture)
                    # Get student's submission
                    try:
                        submission = AssignmentSubmission.objects.get(
                            assignment=assignment,
                            student=student
                        )
                        submission_data = {
                            'id': str(submission.uuid),
                            'submitted': True,
                            'submission_date': submission.submitted_at.isoformat(),
                            'is_late': submission.is_late,
                            'grade': float(submission.grade) if submission.grade else None,
                            'feedback': submission.feedback,
                            'graded': submission.grade is not None,
                            'submission_text': submission.submission_text,
                            'has_file': bool(submission.submission_file),
                            'file_url': submission.submission_file.url if submission.submission_file else None,
                            'original_filename': submission.original_filename,
                        }
                        # Debug logging
                        if submission.grade is not None:
                            print(f"Assignment {assignment.title} - Student {student.username} - Grade: {submission.grade}, Graded: {submission.grade is not None}, Feedback: {submission.feedback}")
                        else:
                            print(f"Assignment {assignment.title} - Student {student.username} - No grade yet")
                    except AssignmentSubmission.DoesNotExist:
                        submission_data = {
                            'submitted': False,
                            'submission_date': None,
                            'is_late': False,
                            'grade': None,
                            'feedback': '',
                            'graded': False,
                        }

                    lecture_data.update({
                        'assignment_id': str(assignment.uuid),
                        'title': assignment.title,
                        'description': assignment.description,
                        'instructions': assignment.instructions,
                        'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
                        'max_points': assignment.max_points,
                        'passing_score': assignment.passing_score,
                        'allow_late_submission': assignment.allow_late_submission,
                        'attachment': assignment.attachment.url if assignment.attachment else None,
                        'attachment_name': assignment.attachment.name.split('/')[-1] if assignment.attachment else None,
                        'submission': submission_data,
                    })
                except (Assignment.DoesNotExist, Exception) as e:
                    print(f"Error getting assignment for lecture {lecture.id}: {str(e)}")
                    lecture_data.update({
                        'assignment_id': None,
                        'title': '',
                        'description': '',
                        'instructions': '',
                        'due_date': None,
                        'max_points': 0,
                        'passing_score': 0,
                        'allow_late_submission': False,
                        'attachment': None,
                        'attachment_name': None,
                        'submission': {
                            'submitted': False,
                            'submission_date': None,
                            'is_late': False,
                            'grade': None,
                            'feedback': '',
                            'graded': False,
                        },
                    })

            lectures.append(lecture_data)

        sections.append({
            'id': str(section.uuid),
            'title': section.title,
            'description': section.description,
            'order': section.order,
            'is_preview': section.is_preview,
            'lectures': lectures,
            'completed_lectures': sum(1 for lecture in lectures if lecture['is_completed']),
            'total_lectures': len(lectures),
        })

    # Calculate overall progress
    total_lectures = sum(section['total_lectures'] for section in sections)
    completed_lectures = sum(section['completed_lectures'] for section in sections)
    progress_percentage = (completed_lectures / total_lectures * 100) if total_lectures > 0 else 0

    return Response({
        'course': {
            'id': str(course.uuid),
            'title': course.title,
            'description': course.description,
            'instructor': f"{course.instructor.first_name} {course.instructor.last_name}",
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'level': course.level,
            'category': course.category.name if course.category else 'General',
        },
        'enrollment': {
            'id': str(enrollment.uuid),
            'enrolled_date': enrollment.enrolled_date.isoformat(),
            'progress_percentage': float(enrollment.progress_percentage),
            'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
            'status': enrollment.status,
        },
        'sections': sections,
        'progress': {
            'total_lectures': total_lectures,
            'completed_lectures': completed_lectures,
            'progress_percentage': round(progress_percentage, 2),
        }
    })

@api_view(['POST'])
@permission_classes([IsStudent])
def mark_lecture_complete(request, course_uuid, lecture_uuid):
    """Mark a lecture as completed for the student"""

    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    lecture = get_object_or_404(Lecture, uuid=lecture_uuid, section__course=course)
    student = request.user

    # Check if student is enrolled
    try:
        enrollment = Enrollment.objects.get(course=course, student=student, status='active')
    except Enrollment.DoesNotExist:
        return Response(
            {'error': 'You must be enrolled in this course'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get or create lecture progress
    lecture_progress, created = LectureProgress.objects.get_or_create(
        enrollment=enrollment,
        lecture=lecture,
        defaults={
            'is_completed': False,
            'progress_seconds': 0,
            'last_watched_position': 0,
            'watch_count': 0
        }
    )

    # Mark as complete
    lecture_progress.mark_completed()

    # Update last accessed time
    enrollment.last_accessed = timezone.now()
    enrollment.save(update_fields=['last_accessed'])

    return Response({
        'success': True,
        'message': 'Lecture marked as completed',
        'progress_percentage': enrollment.progress_percentage
    })

@api_view(['POST'])
@permission_classes([IsStudent])
def submit_assignment(request, assignment_uuid):
    """Submit assignment with file upload"""

    from apps.assessments.models import Assignment, AssignmentSubmission

    assignment = get_object_or_404(Assignment, uuid=assignment_uuid)
    student = request.user

    # Check if student is enrolled in the course
    try:
        enrollment = Enrollment.objects.get(
            course=assignment.course,
            student=student,
            status='active'
        )
    except Enrollment.DoesNotExist:
        return Response(
            {'error': 'You must be enrolled in this course'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if assignment is still accepting submissions
    if assignment.due_date and timezone.now() > assignment.due_date:
        if not assignment.allow_late_submission:
            return Response(
                {'error': 'Assignment deadline has passed and late submissions are not allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # Check if student already submitted
    if AssignmentSubmission.objects.filter(assignment=assignment, student=student).exists():
        return Response(
            {'error': 'You have already submitted this assignment'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get submission data
    submission_text = request.data.get('submission_text', '')
    submission_file = request.FILES.get('submission_file')

    if not submission_text.strip() and not submission_file:
        return Response(
            {'error': 'Please provide either text submission or upload a file'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if submission is late
    if assignment.due_date:
        is_late = timezone.now() > assignment.due_date
        print(f"Assignment has due date: {assignment.due_date}, Current time: {timezone.now()}, Is late: {is_late}")
    else:
        is_late = False  # No due date means it can't be late
        print(f"Assignment has no due date, setting is_late to False")

    # Create submission
    try:
        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=student,
            enrollment=enrollment,
            submission_text=submission_text,
            submission_file=submission_file,
            original_filename=submission_file.name if submission_file else '',
            is_late=is_late
        )
            
    except Exception as e:
        print(f"Error creating submission: {str(e)}")
        return Response(
            {'error': f'Failed to create submission: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Auto-mark lecture as complete when assignment is submitted
    try:
        lecture = assignment.lecture
        if lecture:
            lecture_progress, created = LectureProgress.objects.get_or_create(
                enrollment=enrollment,
                lecture=lecture,
                defaults={
                    'is_completed': False,
                    'progress_seconds': 0,
                    'last_watched_position': 0,
                    'watch_count': 0
                }
            )

            if not lecture_progress.is_completed:
                lecture_progress.mark_completed()

    except Exception as e:
        pass

    return Response({
        'success': True,
        'message': 'Assignment submitted successfully',
        'submission': {
            'id': str(submission.uuid),
            'submitted_at': submission.submitted_at.isoformat(),
            'is_late': submission.is_late,
            'original_filename': submission.original_filename,
            'has_file': bool(submission.submission_file),
            'has_text': bool(submission.submission_text.strip()),
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_submission_file(request, submission_uuid):
    """Download assignment submission file"""
    from django.http import HttpResponse, Http404
    from django.core.files.storage import default_storage
    import mimetypes
    import os
    from apps.assessments.models import AssignmentSubmission

    try:
        submission = AssignmentSubmission.objects.get(uuid=submission_uuid)

        # Check permissions: students can download their own submissions,
        # instructors can download submissions from their courses
        if request.user.user_type == 'student':
            if submission.student != request.user:
                raise Http404("Submission not found")
        elif request.user.user_type == 'instructor':
            if submission.assignment.course.instructor != request.user:
                raise Http404("Submission not found")
        else:
            raise Http404("Submission not found")

    except AssignmentSubmission.DoesNotExist:
        raise Http404("Submission not found")

    if not submission.submission_file:
        raise Http404("No file attached to this submission")

    # Get the file path
    file_path = submission.submission_file.name
    
    # Check if file exists
    if not default_storage.exists(file_path):
        raise Http404("File not found on server")

    # Get file content
    try:
        file_content = default_storage.open(file_path).read()
    except Exception as e:
        raise Http404("Error reading file")

    # Determine content type
    content_type, _ = mimetypes.guess_type(submission.original_filename)
    if not content_type:
        content_type = 'application/octet-stream'

    # Create response
    response = HttpResponse(file_content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{submission.original_filename}"'
    response['Content-Length'] = len(file_content)
    
    return response

@api_view(['GET'])
@permission_classes([IsStudent])
def student_enrolled_courses(request):
    """Get student's enrolled courses with progress"""
    
    enrollments = Enrollment.objects.filter(
        student=request.user,
        status='active'
    ).select_related('course', 'course__instructor').order_by('-last_accessed')
    
    enrolled_data = []
    for enrollment in enrollments:
        course = enrollment.course
        
        # Calculate total lessons and completed
        total_lessons = Lecture.objects.filter(
            section__course=course
        ).count()
        
        completed_lessons = LectureProgress.objects.filter(
            enrollment=enrollment,
            is_completed=True
        ).count()
        
        # Get next lesson
        incomplete_lectures = Lecture.objects.filter(
            section__course=course
        ).exclude(
            id__in=LectureProgress.objects.filter(
                enrollment=enrollment,
                is_completed=True
            ).values_list('lecture_id', flat=True)
        ).order_by('section__order', 'order').first()
        
        # Estimate completion time
        remaining_lessons = total_lessons - completed_lessons
        avg_lesson_time = 30  # minutes
        estimated_hours = (remaining_lessons * avg_lesson_time) / 60
        
        if estimated_hours < 24:
            estimated_completion = f"{int(estimated_hours)} hours"
        elif estimated_hours < 168:
            estimated_completion = f"{int(estimated_hours/24)} days"
        else:
            estimated_completion = f"{int(estimated_hours/168)} weeks"
        
        enrolled_data.append({
            'id': str(enrollment.uuid),
            'course_id': str(course.uuid),
            'title': course.title,
            'instructor': f"{course.instructor.first_name} {course.instructor.last_name}",
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'progress': float(enrollment.progress_percentage),
            'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
            'next_lesson': incomplete_lectures.title if incomplete_lectures else "All lessons completed",
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'estimated_completion': estimated_completion
        })
    
    return Response(enrolled_data)


@api_view(['POST'])
@permission_classes([IsStudent])
def enroll_course(request, course_uuid):
    """Enroll student in a course"""

    course = get_object_or_404(Course, uuid=course_uuid)
    student = request.user

    # Check if already enrolled
    if Enrollment.objects.filter(course=course, student=student).exists():
        return Response(
            {'error': 'Already enrolled in this course'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Check if course is free or student has subscription
    if course.course_type == 'coursera_plus':
        # Check if student has active Plus subscription
        if not student.has_plus_access:
            return Response(
                {
                    'error': 'Coursera Plus subscription required',
                    'requires_subscription': True,
                    'course_type': 'coursera_plus',
                    'course_title': course.title,
                    'checkout_url': '/checkout',  # Frontend can use this to redirect
                    'message': f'Upgrade to Coursera Plus to access "{course.title}" and thousands of other courses'
                },
                status=status.HTTP_402_PAYMENT_REQUIRED
            )
    
    # Create enrollment
    enrollment = Enrollment.objects.create(
        student=student,
        course=course,
        enrolled_date=timezone.now()
    )

    # Update course enrolled count
    course.total_enrolled += 1
    course.save()

    # Create enrollment notifications
    from apps.notifications.services import NotificationService
    notification_result = NotificationService.create_enrollment_notification(enrollment)

    return Response({
        'message': 'Successfully enrolled in course',
        'enrollment_id': str(enrollment.uuid)
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsStudent])
def bookmark_course(request, course_uuid):
    """Add/remove course bookmark"""
    
    course = get_object_or_404(Course, uuid=course_uuid)
    student = request.user
    
    bookmark, created = CourseBookmark.objects.get_or_create(
        student=student,
        course=course
    )
    
    if not created:
        bookmark.delete()
        return Response({'message': 'Bookmark removed'})
    
    return Response({'message': 'Course bookmarked'})

@api_view(['GET'])
@permission_classes([IsStudent])
def student_certificates(request):
    """Get student's earned certificates"""
    
    certificates = Certificate.objects.filter(
        student=request.user
    ).select_related('course', 'enrollment')
    
    cert_data = []
    for cert in certificates:
        cert_data.append({
            'id': str(cert.uuid),
            'course_title': cert.course.title,
            'instructor': f"{cert.course.instructor.first_name} {cert.course.instructor.last_name}",
            'issue_date': cert.issue_date.isoformat(),
            'certificate_id': cert.certificate_number,
            'verification_url': f"https://coursera.com/verify/{cert.verification_code}",
            'grade': float(cert.final_grade) if cert.final_grade else None,
            'thumbnail': cert.course.thumbnail.url if cert.course.thumbnail else None
        })
    
    return Response(cert_data)

@api_view(['GET'])
@permission_classes([IsStudent])
def student_achievements(request):
    """Get student achievements and gamification data"""
    
    student = request.user
    profile, _ = StudentProfile.objects.get_or_create(user=student)
    
    # Calculate points and level
    total_points = calculate_total_points(student)
    current_level = total_points // 250  # 250 points per level
    next_level_points = (current_level + 1) * 250
    
    # Calculate ranks (simplified)
    global_rank = User.objects.filter(
        user_type='student',
        student_profile__total_learning_hours__gt=profile.total_learning_hours
    ).count() + 1
    
    # Monthly rank
    month_start = timezone.now().replace(day=1)
    monthly_rank = 50  # Simplified
    
    # Get all achievements
    achievements = get_all_achievements(student)
    
    return Response({
        'total_points': total_points,
        'current_level': current_level,
        'next_level_points': next_level_points,
        'global_rank': global_rank,
        'monthly_rank': monthly_rank,
        'achievements': achievements
    })

# Helper Functions
def calculate_learning_streak(student):
    """Calculate current learning streak"""
    today = timezone.now().date()
    streak = 0
    
    for i in range(30):  # Check last 30 days
        check_date = today - timedelta(days=i)
        has_activity = LectureProgress.objects.filter(
            enrollment__student=student,
            updated_at__date=check_date
        ).exists()
        
        if has_activity:
            streak += 1
        elif i > 0:  # Don't break on today if no activity yet
            break
    
    return streak


def calculate_total_points(student):
    """Calculate total points for gamification"""
    points = 0
    
    # Points for completed courses (100 each)
    completed = Enrollment.objects.filter(
        student=student,
        status='completed'
    ).count()
    points += completed * 100
    
    # Points for lessons (5 each)
    lessons = LectureProgress.objects.filter(
        enrollment__student=student,
        is_completed=True
    ).count()
    points += lessons * 5
    
    # Points for quizzes (10-50 based on score)
    quizzes = QuizAttempt.objects.filter(
        student=student,
        passed=True
    ).count()
    points += quizzes * 25
    
    return points

def get_all_achievements(student):
    """Get comprehensive list of achievements"""
    
    achievements = [
        {
            'id': 1,
            'title': 'First Steps',
            'description': 'Complete your first lesson',
            'icon': '👶',
            'earned': LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).exists(),
            'date': None,
            'progress': 100 if LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).exists() else 0
        },
        {
            'id': 2,
            'title': 'Dedicated Learner',
            'description': 'Complete 10 lessons',
            'icon': '📚',
            'earned': False,
            'progress': min(100, LectureProgress.objects.filter(
                enrollment__student=student,
                is_completed=True
            ).count() * 10)
        },
        {
            'id': 3,
            'title': 'Week Warrior',
            'description': '7 day learning streak',
            'icon': '🔥',
            'earned': calculate_learning_streak(student) >= 7,
            'progress': min(100, calculate_learning_streak(student) * 100 / 7)
        },
        {
            'id': 4,
            'title': 'Quiz Master',
            'description': 'Score 100% on 5 quizzes',
            'icon': '🏆',
            'earned': False,
            'progress': min(100, QuizAttempt.objects.filter(
                student=student,
                score__gte=100
            ).count() * 20)
        },
        {
            'id': 5,
            'title': 'Speed Learner',
            'description': 'Complete a course in 7 days',
            'icon': '⚡',
            'earned': False,
            'progress': 0
        },
        {
            'id': 6,
            'title': 'Polyglot',
            'description': 'Complete courses in 3 different categories',
            'icon': '🌍',
            'earned': False,
            'progress': 0
        }
    ]
    
    # Set earned dates
    for achievement in achievements:
        if achievement['earned']:
            achievement['date'] = timezone.now().date().isoformat()
    
    return achievements


@api_view(['POST'])
@permission_classes([IsStudent])
def attempt_quiz(request, quiz_uuid):
    """Start or submit a quiz attempt with auto-grading"""

    quiz = get_object_or_404(Quiz, uuid=quiz_uuid)
    student = request.user

    # Check if student is enrolled
    try:
        enrollment = Enrollment.objects.get(
            course=quiz.course,
            student=student,
            status='active'
        )
    except Enrollment.DoesNotExist:
        return Response(
            {'error': 'You must be enrolled in this course'},
            status=status.HTTP_403_FORBIDDEN
        )

    action = request.data.get('action', 'start')  # 'start' or 'submit'

    # Check if student can still attempt (only for starting new attempts)
    if action == 'start':
        existing_attempts = QuizAttempt.objects.filter(
            student=student,
            quiz=quiz
        ).count()

        if existing_attempts >= quiz.max_attempts:
            return Response(
                {'error': f'Maximum {quiz.max_attempts} attempts exceeded'},
                status=status.HTTP_400_BAD_REQUEST
            )

    if action == 'start':
        # Create new quiz attempt
        attempt = QuizAttempt.objects.create(
            student=student,
            quiz=quiz,
            enrollment=enrollment,
            attempt_number=existing_attempts + 1
        )

        # Get quiz questions with options
        questions_data = []
        for question in quiz.questions.all().order_by('order'):
            question_data = {
                'id': str(question.uuid),
                'text': question.question_text,
                'type': question.question_type,
                'points': question.points,
                'order': question.order,
                'options': []
            }

            if question.question_type in ['multiple_choice', 'true_false', 'multiple_select']:
                for option in question.options.all().order_by('order'):
                    question_data['options'].append({
                        'id': str(option.uuid),
                        'text': option.option_text,
                        'order': option.order
                    })

            questions_data.append(question_data)

        return Response({
            'attempt_id': str(attempt.uuid),
            'quiz': {
                'id': str(quiz.uuid),
                'title': quiz.title,
                'description': quiz.description,
                'time_limit': quiz.time_limit,
                'passing_score': quiz.passing_score,
                'show_answers': quiz.show_answers,
            },
            'questions': questions_data,
            'start_time': attempt.start_time.isoformat(),
        })

    elif action == 'submit':
        # Submit quiz attempt
        attempt_id = request.data.get('attempt_id')
        answers = request.data.get('answers', {})  # Dict of question_id: answer

        try:
            attempt = QuizAttempt.objects.get(
                uuid=attempt_id,
                student=student,
                quiz=quiz,
                end_time__isnull=True
            )
        except QuizAttempt.DoesNotExist:
            return Response(
                {'error': 'Invalid or completed attempt'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Grade the quiz
        total_points = 0
        earned_points = 0

        for question in quiz.questions.all():
            question_id = str(question.uuid)
            answer = answers.get(question_id)

            total_points += question.points
            points_earned = 0
            is_correct = False

            if answer:
                if question.question_type == 'multiple_choice':
                    # Single correct answer
                    selected_option_id = answer.get('selected_option')
                    if selected_option_id:
                        try:
                            selected_option = QuestionOption.objects.get(uuid=selected_option_id)
                            if selected_option.is_correct:
                                is_correct = True
                                points_earned = question.points
                        except QuestionOption.DoesNotExist:
                            pass

                elif question.question_type == 'true_false':
                    # True/False question
                    selected_option_id = answer.get('selected_option')
                    if selected_option_id:
                        try:
                            selected_option = QuestionOption.objects.get(uuid=selected_option_id)
                            if selected_option.is_correct:
                                is_correct = True
                                points_earned = question.points
                        except QuestionOption.DoesNotExist:
                            pass

                elif question.question_type == 'multiple_select':
                    # Multiple correct answers
                    selected_option_ids = answer.get('selected_options', [])
                    correct_option_ids = set(
                        str(opt.uuid) for opt in question.options.filter(is_correct=True)
                    )

                    if set(selected_option_ids) == correct_option_ids:
                        is_correct = True
                        points_earned = question.points

                elif question.question_type == 'fill_blank':
                    # Text answer
                    text_answer = answer.get('text_answer', '').strip().lower()
                    correct_answers = [ans.lower().strip() for ans in question.correct_answers]

                    if text_answer in correct_answers:
                        is_correct = True
                        points_earned = question.points

            earned_points += points_earned

            # Save response
            response = QuestionResponse.objects.create(
                attempt=attempt,
                question=question,
                text_answer=answer.get('text_answer', '') if answer else '',
                is_correct=is_correct,
                points_earned=points_earned
            )

            # Add selected options for multiple choice questions
            if answer and answer.get('selected_option'):
                try:
                    option = QuestionOption.objects.get(uuid=answer['selected_option'])
                    response.selected_options.add(option)
                except QuestionOption.DoesNotExist:
                    pass
            elif answer and answer.get('selected_options'):
                for option_id in answer['selected_options']:
                    try:
                        option = QuestionOption.objects.get(uuid=option_id)
                        response.selected_options.add(option)
                    except QuestionOption.DoesNotExist:
                        pass

        # Calculate final score percentage
        score_percentage = (earned_points / total_points * 100) if total_points > 0 else 0
        passed = score_percentage >= quiz.passing_score

        # Update attempt
        attempt.end_time = timezone.now()
        attempt.score = score_percentage
        attempt.passed = passed
        attempt.save()

        # Auto-mark lecture as complete on FIRST attempt completion (regardless of pass/fail)
        if quiz.lecture:
            try:
                lecture_progress, created = LectureProgress.objects.get_or_create(
                    enrollment=enrollment,
                    lecture=quiz.lecture,
                    defaults={
                        'is_completed': False,
                        'progress_seconds': 0,
                        'last_watched_position': 0,
                        'watch_count': 0
                    }
                )

                # Mark complete on first attempt completion
                if not lecture_progress.is_completed and attempt.attempt_number == 1:
                    lecture_progress.mark_completed()
            except Exception as e:
                pass

        # Calculate best score and overall pass status across all attempts
        all_attempts = QuizAttempt.objects.filter(
            student=student,
            quiz=quiz,
            end_time__isnull=False  # Only completed attempts
        ).order_by('-score')

        best_score = score_percentage  # Current attempt score as fallback
        overall_passed = passed  # Current attempt passed status as fallback

        if all_attempts.exists():
            best_score = max(attempt.score or 0 for attempt in all_attempts)
            overall_passed = any(attempt.passed for attempt in all_attempts)

        return Response({
            'success': True,
            'results': {
                'score': float(score_percentage),  # Current attempt score
                'best_score': float(best_score),  # Best score across all attempts
                'earned_points': earned_points,
                'total_points': total_points,
                'passed': overall_passed,  # Overall pass status (true if passed any attempt)
                'current_attempt_passed': passed,  # Current attempt pass status
                'passing_score': quiz.passing_score,
                'attempt_number': attempt.attempt_number,
                'attempts_remaining': quiz.max_attempts - attempt.attempt_number,
            }
        })

    else:
        return Response(
            {'error': 'Invalid action. Use "start" or "submit"'},
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['GET'])
@permission_classes([IsStudent])
def plus_courses_preview(request):
    """Get preview of Plus courses for upgrade promotion"""

    student = request.user

    # Check current subscription status
    if student.has_plus_access:
        return Response(
            {'message': 'You already have Plus access'},
            status=status.HTTP_200_OK
        )

    # Get sample of Plus courses to show what they're missing
    plus_courses = Course.objects.filter(
        course_type='coursera_plus',
        status='published'
    ).order_by('-average_rating', '-total_enrolled')[:12]

    courses_data = []
    for course in plus_courses:
        # Calculate total duration
        total_duration = 0
        for section in course.sections.all():
            for lecture in section.lectures.all():
                if lecture.content_type == 'video':
                    try:
                        from apps.content.models import VideoContent
                        video_content = VideoContent.objects.get(lecture=lecture)
                        total_duration += video_content.duration
                    except:
                        pass
        total_duration = total_duration / 3600  # Convert to hours

        courses_data.append({
            'id': str(course.uuid),
            'title': course.title,
            'instructor': f"{course.instructor.first_name} {course.instructor.last_name}",
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'rating': float(course.average_rating),
            'students': course.total_enrolled,
            'duration': f"{int(total_duration)} hours",
            'level': course.level,
            'category': course.category.name if course.category else 'General',
            'description': course.description[:150] + '...' if len(course.description) > 150 else course.description
        })

    # Get stats about Plus benefits
    total_plus_courses = Course.objects.filter(
        course_type='coursera_plus',
        status='published'
    ).count()

    total_free_courses = Course.objects.filter(
        course_type='free',
        status='published'
    ).count()

    return Response({
        'preview_courses': courses_data,
        'benefits': {
            'total_plus_courses': total_plus_courses,
            'total_free_courses': total_free_courses,
            'unlimited_access': True,
            'certificates_included': True,
            'offline_download': True,
            'no_ads': True
        },
        'pricing': {
            'monthly': 49.99,
            'yearly': 399.99,
            'yearly_savings': round((49.99 * 12) - 399.99, 2),
            'yearly_savings_percentage': round(((49.99 * 12) - 399.99) / (49.99 * 12) * 100)
        },
        'checkout_url': '/api/payments/checkout/data/'
    })