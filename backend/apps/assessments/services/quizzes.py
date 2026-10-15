"""Quiz attempts: start, grade, finish.

An answer is what the student's browser sent, so nothing in it is trusted: an option only
counts when it belongs to the question being answered, ids that are not ids and answers that
are not objects are simply "not answered", and a submission that arrives after the time limit
(plus a short grace for the network) closes the attempt at zero.
"""
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.api.errors import ServiceError
from apps.core.events import emit, quiz_attempt_finished
from apps.learning import services as learning

from ..models import QuestionResponse, QuizAttempt

TWO_PLACES = Decimal('0.01')
TIME_LIMIT_EXCEEDED = 'time_limit_exceeded'


def start_attempt(student, quiz, enrollment):
    """Open a new attempt; unfinished attempts count against ``max_attempts``."""
    if not quiz.is_active:
        raise ServiceError('This quiz is not available')

    existing = QuizAttempt.objects.filter(student=student, quiz=quiz).count()
    if existing >= quiz.max_attempts:
        raise ServiceError(f'Maximum {quiz.max_attempts} attempts exceeded')

    return QuizAttempt.objects.create(
        student=student,
        quiz=quiz,
        enrollment=enrollment,
        attempt_number=existing + 1,
    )


def expires_at(attempt, quiz):
    """When the attempt's time limit runs out, ``None`` for a quiz without one."""
    if not quiz.time_limit:
        return None
    return attempt.start_time + timedelta(minutes=quiz.time_limit)


def summary(student, quiz):
    """Where the student stands on a quiz: the one definition of attempts, best score and passed."""
    scores = list(QuizAttempt.objects.filter(student=student, quiz=quiz).values_list('score', flat=True))
    taken = len(scores)
    best = max((score for score in scores if score is not None), default=None)
    return {
        'attempts_taken': taken,
        'attempts_remaining': max(0, quiz.max_attempts - taken),
        'best_score': float(best) if best is not None else 0.0,
        'passed': best is not None and best >= quiz.passing_score,
        'can_attempt': quiz.is_active and taken < quiz.max_attempts,
    }


# --------------------------------------------------------------------------- #
# grading
# --------------------------------------------------------------------------- #
def _as_uuid(value):
    """``value`` as a UUID, ``None`` for anything that is not one."""
    if isinstance(value, uuid.UUID):
        return value
    if not isinstance(value, str):
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _chosen_options(question, answer):
    """The options *of this question* that the answer points at; anything else is ignored."""
    if question.question_type == 'multiple_select':
        raw = answer.get('selected_options')
        raw = raw if isinstance(raw, list) else []
    else:
        raw = [answer.get('selected_option')]
    wanted = {identifier for identifier in map(_as_uuid, raw) if identifier is not None}
    return [option for option in question.options.all() if option.uuid in wanted]


def is_correct(question, answer):
    """Grade one answer; an unanswered or malformed one is wrong."""
    if not isinstance(answer, dict):
        return False

    kind = question.question_type
    if kind in ('multiple_choice', 'true_false'):
        chosen = _chosen_options(question, answer)
        return len(chosen) == 1 and chosen[0].is_correct

    if kind == 'multiple_select':
        chosen = {option.pk for option in _chosen_options(question, answer)}
        correct = {option.pk for option in question.options.all() if option.is_correct}
        return bool(chosen) and chosen == correct

    if kind == 'fill_blank':
        text = answer.get('text_answer')
        if not isinstance(text, str):
            return False
        accepted = [item.strip().lower() for item in question.correct_answers if isinstance(item, str)]
        return text.strip().lower() in accepted

    return False


def _grade_responses(attempt, quiz, answers):
    """Store a response per question; returns ``(earned_points, total_points)``."""
    earned = total = 0
    graded = []
    for question in quiz.questions.prefetch_related('options'):
        answer = answers.get(str(question.uuid))
        answer = answer if isinstance(answer, dict) else None
        total += question.points
        correct = is_correct(question, answer)
        points = question.points if correct else 0
        earned += points

        text = answer.get('text_answer') if answer else ''
        graded.append((
            QuestionResponse(
                attempt=attempt,
                question=question,
                text_answer=text if isinstance(text, str) else '',
                is_correct=correct,
                points_earned=points,
            ),
            _chosen_options(question, answer) if answer else [],
        ))

    QuestionResponse.objects.bulk_create([response for response, _ in graded])
    stored = {response.question_id: response
              for response in QuestionResponse.objects.filter(attempt=attempt)}
    for response, options in graded:
        if options:
            stored[response.question_id].selected_options.add(*options)
    return earned, total


def _percentage(earned, total):
    """Score as a percentage rounded to the two decimals the column stores."""
    if total <= 0:
        return Decimal('0.00')
    return (Decimal(earned) * 100 / Decimal(total)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _close(attempt, *, score, passed, now):
    """Finish the attempt (a plain update: the rules were checked when it was started)."""
    QuizAttempt.objects.filter(pk=attempt.pk).update(
        end_time=now, score=score, passed=passed, updated_at=now)
    attempt.end_time, attempt.score, attempt.passed = now, score, passed


def _too_late(attempt, quiz, now):
    limit = expires_at(attempt, quiz)
    if limit is None:
        return False
    return now > limit + timedelta(seconds=settings.QUIZ_SUBMIT_GRACE_SECONDS)


def submit_attempt(student, quiz, enrollment, attempt_uuid, answers):
    """Grade an open attempt, close it and report the results.

    Answers that arrive after the time limit are refused: the attempt is closed with a score
    of zero (it was used up, and cannot be handed in again) and the caller gets a 400 with
    ``code: time_limit_exceeded``.
    """
    if not isinstance(answers, dict):
        raise ServiceError('answers must be an object keyed by question id')

    now = timezone.now()
    with transaction.atomic():
        try:
            attempt = (
                QuizAttempt.objects.select_for_update()
                .get(uuid=attempt_uuid, student=student, quiz=quiz, end_time__isnull=True)
            )
        except (QuizAttempt.DoesNotExist, ValidationError, ValueError):
            raise ServiceError('Invalid or completed attempt') from None

        late = _too_late(attempt, quiz, now)
        if late:
            earned, total, score, passed = 0, 0, Decimal('0.00'), False
        else:
            earned, total = _grade_responses(attempt, quiz, answers)
            score = _percentage(earned, total)
            passed = score >= quiz.passing_score
        _close(attempt, score=score, passed=passed, now=now)

    # taking the quiz completes its lecture, whatever the score; asking again changes nothing
    if quiz.lecture:
        learning.complete_lecture_once(enrollment, quiz.lecture)

    if late:
        raise ServiceError(
            'Time is up: this attempt was submitted after the time limit and scored zero',
            code=TIME_LIMIT_EXCEEDED,
        )

    # a graded attempt can change the final grade (a retake), so whoever cares is told
    emit(quiz_attempt_finished, attempt=attempt)

    standing = summary(student, quiz)
    return {
        'score': float(score),
        'best_score': standing['best_score'],
        'earned_points': earned,
        'total_points': total,
        'passed': standing['passed'],
        'current_attempt_passed': passed,
        'passing_score': quiz.passing_score,
        'attempt_number': attempt.attempt_number,
        'attempts_remaining': standing['attempts_remaining'],
    }
