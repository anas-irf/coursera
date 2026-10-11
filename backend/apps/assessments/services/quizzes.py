"""Quiz attempts: start, grade, finish."""
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.core.api.errors import ServiceError
from apps.learning import services as learning

from ..models import QuestionOption, QuestionResponse, QuizAttempt

TWO_PLACES = Decimal('0.01')


def start_attempt(student, quiz, enrollment):
    """Open a new attempt; unfinished attempts count against ``max_attempts``."""
    existing = QuizAttempt.objects.filter(student=student, quiz=quiz).count()
    if existing >= quiz.max_attempts:
        raise ServiceError(f'Maximum {quiz.max_attempts} attempts exceeded')

    return QuizAttempt.objects.create(
        student=student,
        quiz=quiz,
        enrollment=enrollment,
        attempt_number=existing + 1,
    )


def _option(option_uuid):
    return QuestionOption.objects.filter(uuid=option_uuid).first()


def _selected_options(answer):
    """The options an answer points at (single choice or multiple select)."""
    if answer.get('selected_option'):
        option = _option(answer['selected_option'])
        return [option] if option else []
    return [option for option in map(_option, answer.get('selected_options') or []) if option]


def is_correct(question, answer):
    """Grade one answer; unanswered questions are wrong."""
    if not answer:
        return False

    kind = question.question_type
    if kind in ('multiple_choice', 'true_false'):
        option_id = answer.get('selected_option')
        option = _option(option_id) if option_id else None
        return bool(option and option.is_correct)

    if kind == 'multiple_select':
        selected = set(answer.get('selected_options', []))
        correct = {str(option.uuid) for option in question.options.filter(is_correct=True)}
        return selected == correct

    if kind == 'fill_blank':
        text = answer.get('text_answer', '').strip().lower()
        return text in [accepted.lower().strip() for accepted in question.correct_answers]

    return False


def _grade_responses(attempt, quiz, answers):
    """Store a response per question; returns ``(earned_points, total_points)``."""
    earned = 0
    total = 0
    for question in quiz.questions.all():
        answer = answers.get(str(question.uuid))
        total += question.points
        correct = is_correct(question, answer)
        points = question.points if correct else 0
        earned += points

        response = QuestionResponse.objects.create(
            attempt=attempt,
            question=question,
            text_answer=answer.get('text_answer', '') if answer else '',
            is_correct=correct,
            points_earned=points,
        )
        if answer:
            response.selected_options.add(*_selected_options(answer))
    return earned, total


def _percentage(earned, total):
    """Score as a percentage rounded to the two decimals the column stores."""
    if total <= 0:
        return Decimal('0.00')
    return (Decimal(earned) * 100 / Decimal(total)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def submit_attempt(student, quiz, enrollment, attempt_uuid, answers):
    """Grade an open attempt, close it and report the results."""
    try:
        attempt = QuizAttempt.objects.get(
            uuid=attempt_uuid,
            student=student,
            quiz=quiz,
            end_time__isnull=True,
        )
    except (QuizAttempt.DoesNotExist, ValidationError, ValueError):
        raise ServiceError('Invalid or completed attempt')

    earned, total = _grade_responses(attempt, quiz, answers)
    score = _percentage(earned, total)
    passed = score >= quiz.passing_score

    attempt.end_time = timezone.now()
    attempt.score = score
    attempt.passed = passed
    attempt.save()

    # the first completed attempt completes the lecture, whatever the score
    if quiz.lecture and attempt.attempt_number == 1:
        learning.complete_lecture_once(enrollment, quiz.lecture)

    finished = list(QuizAttempt.objects.filter(student=student, quiz=quiz, end_time__isnull=False))
    best_score = max((a.score or 0 for a in finished), default=score)
    overall_passed = any(a.passed for a in finished) if finished else passed

    return {
        'score': float(score),
        'best_score': float(best_score),
        'earned_points': earned,
        'total_points': total,
        'passed': overall_passed,
        'current_attempt_passed': passed,
        'passing_score': quiz.passing_score,
        'attempt_number': attempt.attempt_number,
        'attempts_remaining': quiz.max_attempts - attempt.attempt_number,
    }
