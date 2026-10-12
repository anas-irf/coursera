"""Quiz and assignment lectures: how their content is authored and presented."""
import json
from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.courses.extensions import LectureContentHandler, register_content_handler

from .models import Assignment, AssignmentSubmission, Question, QuestionOption, Quiz, QuizAttempt


def _json_field(data, key, default):
    """FormData posts nested structures as JSON strings."""
    value = data.get(key, default)
    if isinstance(value, str):
        value = json.loads(value)
    return value


class QuizHandler(LectureContentHandler):
    content_type = 'quiz'

    def create(self, lecture, data, files):
        """Create quiz, questions and options from lecture data"""
        quiz_settings = _json_field(data, 'quiz_settings', {})
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
        questions_data = _json_field(data, 'questions', [])
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
            for option_order, option_data in enumerate(question_data.get('options', [])):
                QuestionOption.objects.create(
                    question=question,
                    option_text=option_data.get('option_text', ''),
                    is_correct=option_data.get('is_correct', False),
                    order=option_data.get('order', option_order)
                )

    def update(self, lecture, data, files):
        """Update quiz data - for now, the quiz is recreated.

        NOTE: this cascades to attempts and responses (known issue, see docs)."""
        Quiz.objects.filter(lecture=lecture).delete()
        self.create(lecture, data, files)

    # --- instructor view ---------------------------------------------------- #
    def instructor_defaults(self):
        return {'quiz_settings': None, 'questions': []}

    def serialize_for_instructor(self, lecture):
        try:
            quiz = Quiz.objects.get(lecture=lecture)
        except Quiz.DoesNotExist:
            return {
                'quiz_settings': {
                    'passing_score': 60,
                    'time_limit': None,
                    'max_attempts': 3,
                    'weight': 0.0,
                    'randomize_questions': False,
                    'show_answers': True
                },
                'questions': [],
            }

        questions = []
        for question in quiz.questions.all():
            questions.append({
                'question_text': question.question_text,
                'question_type': question.question_type,
                'points': question.points,
                'explanation': question.explanation,
                'options': [
                    {
                        'option_text': option.option_text,
                        'is_correct': option.is_correct,
                        'order': option.order,
                    }
                    for option in question.options.all()
                ],
            })

        return {
            'quiz_settings': {
                'passing_score': quiz.passing_score,
                'time_limit': quiz.time_limit,
                'max_attempts': quiz.max_attempts,
                'weight': float(quiz.weight),  # Ensure it's a float for frontend
                'randomize_questions': quiz.randomize_questions,
                'show_answers': quiz.show_answers
            },
            'questions': questions,
        }

    # --- learner view ------------------------------------------------------- #
    def serialize_for_student(self, lecture, student):
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

            return {
                'quiz_id': str(quiz.uuid),
                'max_attempts': quiz.max_attempts,
                'passing_score': quiz.passing_score,
                'attempts_taken': attempts_count,
                'best_score': float(best_score),
                'passed': best_score >= quiz.passing_score,
                'can_attempt': can_attempt,
            }
        except Exception:
            return {
                'quiz_id': None,
                'max_attempts': 0,
                'passing_score': 0,
                'attempts_taken': 0,
                'best_score': 0,
                'passed': False,
                'can_attempt': False,
            }

    def grade_weight(self, course):
        return Quiz.objects.filter(course=course).aggregate(total=Sum('weight'))['total'] or Decimal('0')


class AssignmentHandler(LectureContentHandler):
    content_type = 'assignment'

    def create(self, lecture, data, files):
        """Create assignment from lecture data"""
        assignment_settings = _json_field(data, 'assignment_settings', {})

        # Parse due date if provided
        due_date = None
        if assignment_settings.get('due_date'):
            try:
                # Parse the datetime from frontend (which sends local time)
                naive_datetime = datetime.fromisoformat(assignment_settings['due_date'].replace('T', ' '))
                # Convert from local timezone to UTC for storage
                due_date = timezone.make_aware(naive_datetime, timezone=timezone.get_current_timezone())
            except (ValueError, AttributeError):
                pass

        # Handle attachment file
        attachment_file = data.get('attachment') or files.get('attachment')

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

    def update(self, lecture, data, files):
        """Update assignment data - preserve existing attachment if no new one provided.

        NOTE: the assignment is recreated, which cascades to its submissions
        (known issue, see docs)."""
        existing_assignment = Assignment.objects.filter(lecture=lecture).first()

        if existing_assignment:
            existing_attachment = existing_assignment.attachment
            existing_assignment.delete()

            # Create new assignment with updated data
            self.create(lecture, data, files)

            # If no new attachment was provided, restore the old one
            attachment_file = data.get('attachment') or files.get('attachment')
            if not attachment_file and existing_attachment:
                updated_assignment = Assignment.objects.get(lecture=lecture)
                updated_assignment.attachment = existing_attachment
                updated_assignment.save()
        else:
            self.create(lecture, data, files)

    # --- instructor view ---------------------------------------------------- #
    def instructor_defaults(self):
        return {'assignment_settings': None}

    def serialize_for_instructor(self, lecture):
        try:
            assignment = Assignment.objects.get(lecture=lecture)
        except Assignment.DoesNotExist:
            return {
                'assignment_settings': {
                    'max_points': 100,
                    'due_date': None,
                    'passing_score': 60,
                    'weight': 0.0,
                    'instructions': '',
                    'attachment': None,
                    'existing_attachment': None,
                    'allow_late_submission': True
                }
            }

        # Format due_date for datetime-local input (remove timezone info)
        due_date_formatted = None
        if assignment.due_date:
            local_dt = timezone.localtime(assignment.due_date)
            due_date_formatted = local_dt.strftime('%Y-%m-%dT%H:%M')

        return {
            'assignment_settings': {
                'max_points': assignment.max_points,
                'due_date': due_date_formatted,
                'passing_score': assignment.passing_score,
                'weight': float(assignment.weight),
                'instructions': assignment.instructions,
                'attachment': assignment.attachment.url if assignment.attachment else None,
                'existing_attachment': assignment.attachment.url if assignment.attachment else None,
                'allow_late_submission': assignment.allow_late_submission
            }
        }

    # --- learner view ------------------------------------------------------- #
    def serialize_for_student(self, lecture, student):
        try:
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
            except AssignmentSubmission.DoesNotExist:
                submission_data = {
                    'submitted': False,
                    'submission_date': None,
                    'is_late': False,
                    'grade': None,
                    'feedback': '',
                    'graded': False,
                }

            return {
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
            }
        except Exception:
            return {
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
            }

    def grade_weight(self, course):
        return Assignment.objects.filter(course=course).aggregate(total=Sum('weight'))['total'] or Decimal('0')


def register():
    register_content_handler(QuizHandler())
    register_content_handler(AssignmentHandler())
