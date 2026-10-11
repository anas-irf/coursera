# courses/student_views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

from apps.accounts.permissions import IsStudent

from apps.learning.models import Enrollment, LectureProgress
from apps.certificates.models import Certificate
from apps.accounts.models import User, StudentProfile
from apps.assessments.models import QuizAttempt, Quiz, QuestionResponse, QuestionOption


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
