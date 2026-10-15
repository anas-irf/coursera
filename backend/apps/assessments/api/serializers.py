"""JSON shapes of the assessments endpoints."""
from django.utils import timezone

from ..services import quizzes


def quiz_start_payload(attempt, quiz):
    """What the student gets when an attempt starts: the quiz without its answers."""
    questions = []
    for question in quiz.questions.all().order_by('order'):
        options = []
        if question.question_type in ('multiple_choice', 'true_false', 'multiple_select'):
            options = [
                {'id': str(option.uuid), 'text': option.option_text, 'order': option.order}
                for option in question.options.all().order_by('order')
            ]
        questions.append({
            'id': str(question.uuid),
            'text': question.question_text,
            'type': question.question_type,
            'points': question.points,
            'order': question.order,
            'options': options,
        })

    expires = quizzes.expires_at(attempt, quiz)
    return {
        'attempt_id': str(attempt.uuid),
        'quiz': {
            'id': str(quiz.uuid),
            'title': quiz.title,
            'description': quiz.description,
            'time_limit': quiz.time_limit,
            'passing_score': quiz.passing_score,
            'show_answers': quiz.show_answers,
        },
        'questions': questions,
        'start_time': attempt.start_time.isoformat(),
        'expires_at': expires.isoformat() if expires else None,
    }


def submission_receipt(submission):
    """The student's confirmation after handing in."""
    return {
        'id': str(submission.uuid),
        'submitted_at': submission.submitted_at.isoformat(),
        'is_late': submission.is_late,
        'original_filename': submission.original_filename,
        'has_file': bool(submission.submission_file),
        'has_text': bool(submission.submission_text.strip()),
    }


def assignment_row(assignment):
    """One assignment of the instructor's overview (needs the selector's counters)."""
    total = assignment.submission_count
    graded = assignment.graded_count
    return {
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
        'total_submissions': total,
        'graded_submissions': graded,
        'pending_submissions': total - graded,
        'created_at': assignment.created_at.isoformat(),
    }


def submission_row(submission):
    """One submission in the instructor's grading list."""
    student = submission.student
    return {
        'id': str(submission.uuid),
        'student_id': str(student.uuid),
        'student_name': f"{student.first_name} {student.last_name}",
        'student_email': student.email,
        'submission_text': submission.submission_text,
        'has_file': bool(submission.submission_file),
        'original_filename': submission.original_filename,
        'submitted_at': submission.submitted_at.isoformat(),
        'is_late': submission.is_late,
        'grade': float(submission.grade) if submission.grade is not None else None,
        'feedback': submission.feedback,
        'graded_by': submission.graded_by.get_full_name() if submission.graded_by else None,
        'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
    }


def graded_submission(submission):
    """The result of grading."""
    return {
        'id': str(submission.uuid),
        'grade': float(submission.grade),
        'feedback': submission.feedback,
        'graded_by': submission.graded_by.get_full_name(),
        'graded_at': submission.graded_at.isoformat(),
    }


# --------------------------------------------------------------------------- #
# the quiz and assignment blocks of a lecture
# --------------------------------------------------------------------------- #
def instructor_quiz(quiz):
    """The quiz as the authoring form edits it.

    Questions and options carry their ``id``: the form sends them back, so an edit changes
    those rows instead of replacing them (and keeps what students answered).
    """
    if quiz is None:
        return {
            'quiz_settings': {
                'passing_score': 60,
                'time_limit': None,
                'max_attempts': 3,
                'weight': 0.0,
                'randomize_questions': False,
                'show_answers': True,
            },
            'questions': [],
        }

    return {
        'quiz_settings': {
            'passing_score': quiz.passing_score,
            'time_limit': quiz.time_limit,
            'max_attempts': quiz.max_attempts,
            'weight': float(quiz.weight),  # the form wants a number
            'randomize_questions': quiz.randomize_questions,
            'show_answers': quiz.show_answers,
        },
        'questions': [
            {
                'id': str(question.uuid),
                'question_text': question.question_text,
                'question_type': question.question_type,
                'points': question.points,
                'explanation': question.explanation,
                'correct_answers': question.correct_answers,
                'options': [
                    {
                        'id': str(option.uuid),
                        'option_text': option.option_text,
                        'is_correct': option.is_correct,
                        'order': option.order,
                    }
                    for option in question.options.all()
                ],
            }
            for question in quiz.questions.all()
        ],
    }


def student_quiz(quiz, standing):
    """The quiz block of the player; ``standing`` is ``quizzes.summary`` (``None`` without a quiz)."""
    if quiz is None:
        # a quiz lecture that has no quiz yet
        return {
            'quiz_id': None,
            'max_attempts': 0,
            'passing_score': 0,
            'attempts_taken': 0,
            'best_score': 0,
            'passed': False,
            'can_attempt': False,
        }
    return {
        'quiz_id': str(quiz.uuid),
        'max_attempts': quiz.max_attempts,
        'passing_score': quiz.passing_score,
        'attempts_taken': standing['attempts_taken'],
        'best_score': standing['best_score'],
        'passed': standing['passed'],
        'can_attempt': standing['can_attempt'],
    }


def instructor_assignment(assignment):
    """The assignment settings as the authoring form edits them."""
    if assignment is None:
        return {
            'assignment_settings': {
                'max_points': 100,
                'due_date': None,
                'passing_score': 60,
                'weight': 0.0,
                'instructions': '',
                'attachment': None,
                'existing_attachment': None,
                'allow_late_submission': True,
            }
        }

    due_date = None
    if assignment.due_date:
        # the form's datetime-local input wants local time without an offset
        due_date = timezone.localtime(assignment.due_date).strftime('%Y-%m-%dT%H:%M')

    return {
        'assignment_settings': {
            'max_points': assignment.max_points,
            'due_date': due_date,
            'passing_score': assignment.passing_score,
            'weight': float(assignment.weight),
            'instructions': assignment.instructions,
            'attachment': assignment.attachment.url if assignment.attachment else None,
            'existing_attachment': assignment.attachment.url if assignment.attachment else None,
            'allow_late_submission': assignment.allow_late_submission,
        }
    }


def _open_submission():
    """The student's block of an assignment they have not handed in."""
    return {
        'submitted': False,
        'submission_date': None,
        'is_late': False,
        'grade': None,
        'feedback': '',
        'graded': False,
    }


def student_assignment(assignment, submission):
    """The assignment block of the player (``assignment`` is ``None`` while the lecture has none)."""
    if assignment is None:
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
            'submission': _open_submission(),
        }

    if submission is None:
        block = _open_submission()
    else:
        block = {
            'id': str(submission.uuid),
            'submitted': True,
            'submission_date': submission.submitted_at.isoformat(),
            'is_late': submission.is_late,
            # a grade of 0 is a grade
            'grade': float(submission.grade) if submission.grade is not None else None,
            'feedback': submission.feedback,
            'graded': submission.grade is not None,
            'submission_text': submission.submission_text,
            'has_file': bool(submission.submission_file),
            'file_url': submission.submission_file.url if submission.submission_file else None,
            'original_filename': submission.original_filename,
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
        'submission': block,
    }
