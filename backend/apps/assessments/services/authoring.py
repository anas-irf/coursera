"""Authoring quizzes and assignments: create them from the lecture form, change them in place.

The lecture form posts its nested structures as JSON strings next to its files, so the parsing
lives here, and anything that is not what the form sends is a 400 with a message.

An edit never recreates a quiz or an assignment: students' attempts and hand-ins belong to
those rows.  An update changes the rows it was given values for, and deletes only a question or
an option that was removed from the form (an answered question takes its responses with it; the
attempts keep their scores).
"""
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.core.api.errors import ServiceError

from ..models import Assignment, Question, QuestionOption, Quiz

QUESTION_TYPES = {value for value, _label in Question.QUESTION_TYPE_CHOICES}
TYPES_WITH_OPTIONS = ('multiple_choice', 'true_false', 'multiple_select')
MAX_WEIGHT = Decimal('100')

QUIZ_DEFAULTS = {
    'passing_score': 60,
    'time_limit': None,
    'max_attempts': 3,
    'weight': Decimal('0'),
    'randomize_questions': False,
    'show_answers': True,
}
ASSIGNMENT_DEFAULTS = {
    'instructions': '',
    'max_points': 100,
    'passing_score': 60,
    'weight': Decimal('0'),
    'allow_late_submission': True,
    'due_date': None,
}


# --------------------------------------------------------------------------- #
# reading the form
# --------------------------------------------------------------------------- #
def posted_json(data, key):
    """The structure posted under ``key`` (a JSON string in a multipart form), ``None`` when not sent."""
    value = data.get(key)
    if value is None or value == '':
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            raise ServiceError(f'{key} must be valid JSON') from None
    return value


def _object(value, name):
    if value is not None and not isinstance(value, dict):
        raise ServiceError(f'{name} must be an object')
    return value


def _whole(value, name, *, minimum=0, maximum=None):
    """A whole number from a JSON number or a numeric string."""
    try:
        if isinstance(value, bool) or value is None:
            raise ValueError
        if isinstance(value, float) and not value.is_integer():
            raise ValueError
        number = int(value.strip()) if isinstance(value, str) else int(value)
    except (TypeError, ValueError, OverflowError):
        raise ServiceError(f'{name} must be a whole number') from None
    if number < minimum or (maximum is not None and number > maximum):
        bounds = f'at least {minimum}' if maximum is None else f'between {minimum} and {maximum}'
        raise ServiceError(f'{name} must be {bounds}')
    return number


def _weight(value, name='weight'):
    try:
        weight = Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        raise ServiceError(f'{name} must be a number') from None
    if not Decimal('0') <= weight <= MAX_WEIGHT:
        raise ServiceError(f'{name} must be between 0 and 100')
    return weight


def _flag(value, name):
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.lower() in ('true', 'false'):
        return value.lower() == 'true'
    raise ServiceError(f'{name} must be true or false')


def _text(value, name, *, maximum=None):
    if not isinstance(value, str) or (maximum is not None and len(value) > maximum):
        limit = f' of at most {maximum} characters' if maximum else ''
        raise ServiceError(f'{name} must be text{limit}')
    return value


# --------------------------------------------------------------------------- #
# quizzes
# --------------------------------------------------------------------------- #
def _quiz_fields(settings):
    """The quiz columns the posted settings set: only the keys that were sent."""
    fields = {}
    if 'passing_score' in settings:
        fields['passing_score'] = _whole(settings['passing_score'], 'passing_score', maximum=100)
    if 'time_limit' in settings:
        limit = settings['time_limit']
        fields['time_limit'] = None if limit in (None, '', 0) else _whole(
            limit, 'time_limit', minimum=1, maximum=24 * 60)
    if 'max_attempts' in settings:
        fields['max_attempts'] = _whole(settings['max_attempts'], 'max_attempts', minimum=1, maximum=100)
    if 'weight' in settings:
        fields['weight'] = _weight(settings['weight'])
    for key in ('randomize_questions', 'show_answers'):
        if key in settings:
            fields[key] = _flag(settings[key], key)
    return fields


def _answers(value, where):
    """Acceptable answers of a fill-in-the-blank question."""
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ServiceError(f'{where}: correct_answers must be a list of text answers')
    return [item.strip() for item in value if item.strip()]


def _options(raw, where):
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ServiceError(f'{where}: options must be a list')
    cleaned = []
    for position, item in enumerate(raw):
        label = f'{where}, option {position + 1}'
        if not isinstance(item, dict):
            raise ServiceError(f'{label} must be an object')
        order = item.get('order', position)
        cleaned.append({
            'id': item.get('id'),
            'option_text': _text(item.get('option_text', ''), f'{label}: option_text', maximum=500),
            'is_correct': _flag(item.get('is_correct', False), f'{label}: is_correct'),
            'order': _whole(order, f'{label}: order', minimum=0, maximum=1000),
        })
    return cleaned


def _questions(raw):
    """Validated questions of the posted list; ``None`` when the form sent no list."""
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ServiceError('questions must be a list')

    cleaned = []
    for number, item in enumerate(raw, 1):
        where = f'Question {number}'
        if not isinstance(item, dict):
            raise ServiceError(f'{where} must be an object')
        kind = item.get('question_type', 'multiple_choice')
        if kind not in QUESTION_TYPES:
            raise ServiceError(f'{where} has an unknown type')

        question = {
            'id': item.get('id'),
            'question_text': _text(item.get('question_text', ''), f'{where}: question_text'),
            'question_type': kind,
            'points': _whole(item.get('points', 1), f'{where}: points', maximum=1000),
            'explanation': _text(item.get('explanation', ''), f'{where}: explanation'),
            'options': _options(item.get('options'), where) if kind in TYPES_WITH_OPTIONS else [],
        }
        if 'correct_answers' in item:
            question['correct_answers'] = _answers(item['correct_answers'], where)
        cleaned.append(question)
    return cleaned


def _pair(existing, items):
    """The stored row each posted item edits (``None`` for a new one).

    Items carry the ``id`` they were given; a client that sends none (an older one, an API
    script) is matched by position instead, so re-sending a quiz does not lose its answers.
    """
    if not any(item.get('id') for item in items):
        return [existing[index] if index < len(existing) else None for index in range(len(items))]
    by_uuid = {str(row.uuid): row for row in existing}
    return [by_uuid.get(str(item.get('id'))) for item in items]


def _sync_options(question, items):
    existing = list(question.options.order_by('order', 'id'))
    kept = []
    for item, option in zip(items, _pair(existing, items), strict=True):
        fields = {'option_text': item['option_text'], 'is_correct': item['is_correct'], 'order': item['order']}
        if option is None:
            option = QuestionOption.objects.create(question=question, **fields)
        else:
            for name, value in fields.items():
                setattr(option, name, value)
            option.save()
        kept.append(option.pk)
    question.options.exclude(pk__in=kept).delete()


def _sync_questions(quiz, items):
    existing = list(quiz.questions.order_by('order', 'id'))
    kept = []
    for position, (item, question) in enumerate(zip(items, _pair(existing, items), strict=True)):
        fields = {
            'question_text': item['question_text'],
            'question_type': item['question_type'],
            'points': item['points'],
            'explanation': item['explanation'],
            'order': position,
        }
        if 'correct_answers' in item:
            fields['correct_answers'] = item['correct_answers']

        if question is None:
            question = Question.objects.create(quiz=quiz, **fields)
        else:
            for name, value in fields.items():
                setattr(question, name, value)
            question.save()
        _sync_options(question, item['options'])
        kept.append(question.pk)
    quiz.questions.exclude(pk__in=kept).delete()


def create_quiz(lecture, data):
    """Create the quiz of a quiz lecture from the form."""
    settings = _object(posted_json(data, 'quiz_settings'), 'quiz_settings') or {}
    questions = _questions(posted_json(data, 'questions')) or []
    fields = {**QUIZ_DEFAULTS, **_quiz_fields(settings)}

    with transaction.atomic():
        quiz = Quiz.objects.create(
            course=lecture.section.course,
            section=lecture.section,
            lecture=lecture,
            title=lecture.title,
            description=lecture.description or '',
            **fields,
        )
        _sync_questions(quiz, questions)
    return quiz


def update_quiz(lecture, data):
    """Apply the form to the quiz of ``lecture`` in place (creating it when it has none yet)."""
    quiz = Quiz.objects.filter(lecture=lecture).first()
    if quiz is None:
        return create_quiz(lecture, data)

    settings = _object(posted_json(data, 'quiz_settings'), 'quiz_settings') or {}
    fields = _quiz_fields(settings)
    questions = _questions(posted_json(data, 'questions'))   # None: the form did not send them

    with transaction.atomic():
        quiz.title = lecture.title
        quiz.description = lecture.description or ''
        for name, value in fields.items():
            setattr(quiz, name, value)
        quiz.save()
        if questions is not None:
            _sync_questions(quiz, questions)
    return quiz


# --------------------------------------------------------------------------- #
# assignments
# --------------------------------------------------------------------------- #
def _due_date(value):
    """A due date from the form (local time without offset, or ISO 8601 with one); ``None`` clears it."""
    if value in (None, ''):
        return None
    try:
        if not isinstance(value, str):
            raise ValueError
        moment = datetime.fromisoformat(value.replace('T', ' '))
    except ValueError:
        raise ServiceError('due_date must be a date and time like 2026-01-31T18:00') from None
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment, timezone.get_current_timezone())
    return moment


def _assignment_fields(settings):
    """The assignment columns the posted settings set: only the keys that were sent."""
    fields = {}
    if 'instructions' in settings:
        fields['instructions'] = _text(settings['instructions'], 'instructions')
    if 'max_points' in settings:
        fields['max_points'] = _whole(settings['max_points'], 'max_points', minimum=1, maximum=100000)
    if 'passing_score' in settings:
        fields['passing_score'] = _whole(settings['passing_score'], 'passing_score', maximum=100)
    if 'weight' in settings:
        fields['weight'] = _weight(settings['weight'])
    if 'allow_late_submission' in settings:
        fields['allow_late_submission'] = _flag(settings['allow_late_submission'], 'allow_late_submission')
    if 'due_date' in settings:
        fields['due_date'] = _due_date(settings['due_date'])
    return fields


def _attachment(data, files):
    """The uploaded attachment of the request, ``None`` when there is none."""
    candidate = files.get('attachment') or data.get('attachment')
    return candidate if hasattr(candidate, 'read') else None


def create_assignment(lecture, data, files):
    """Create the assignment of an assignment lecture from the form."""
    settings = _object(posted_json(data, 'assignment_settings'), 'assignment_settings') or {}
    fields = {**ASSIGNMENT_DEFAULTS, **_assignment_fields(settings)}

    return Assignment.objects.create(
        course=lecture.section.course,
        section=lecture.section,
        lecture=lecture,
        title=lecture.title,
        description=lecture.description or '',
        attachment=_attachment(data, files),
        **fields,
    )


def update_assignment(lecture, data, files):
    """Apply the form to the assignment of ``lecture`` in place; the attachment stays unless replaced."""
    assignment = Assignment.objects.filter(lecture=lecture).first()
    if assignment is None:
        return create_assignment(lecture, data, files)

    settings = _object(posted_json(data, 'assignment_settings'), 'assignment_settings') or {}
    fields = _assignment_fields(settings)
    attachment = _attachment(data, files)

    assignment.title = lecture.title
    assignment.description = lecture.description or ''
    for name, value in fields.items():
        setattr(assignment, name, value)
    if attachment is not None:
        assignment.attachment = attachment
    assignment.save()
    return assignment
