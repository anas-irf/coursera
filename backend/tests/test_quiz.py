"""Assessment slice: quiz attempts (start / submit / grading rules)."""
import json
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db


def attempt_url(quiz):
    return f'/api/assessments/quizzes/{quiz.uuid}/attempt/'


def start(client, quiz):
    return client.post(attempt_url(quiz), {'action': 'start'}, format='json')


def submit(client, quiz, attempt_id, answers):
    return client.post(attempt_url(quiz), {'action': 'submit', 'attempt_id': attempt_id,
                                           'answers': answers}, format='json')


def play(client, quiz, correct):
    """Start + submit an attempt answering the questions in ``correct`` right."""
    attempt_id = start(client, quiz).json()['attempt_id']
    return submit(client, quiz, attempt_id, f.build_answers(quiz, correct))


@pytest.fixture
def four_type_quiz(instructor, student):
    """Published course whose quiz has one question of each gradable type."""
    questions = [f.mc_question(), f.tf_question(), f.ms_question(), f.fill_question()]
    bundle = f.build_course(instructor, status='published', quiz_questions=questions)
    f.enroll(student, bundle.course)
    return bundle


@pytest.fixture
def two_question_quiz(instructor, student):
    bundle = f.build_course(instructor, status='published',
                            quiz_questions=[f.mc_question(), f.tf_question()])
    f.enroll(student, bundle.course)
    return bundle


# --------------------------------------------------------------------------- #
# start
# --------------------------------------------------------------------------- #
def test_start_attempt_returns_questions_without_the_answers(auth_client, student, four_type_quiz):
    """Starting an attempt returns questions / options without is_correct."""
    quiz = four_type_quiz.quiz

    r = start(auth_client(student), quiz)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'attempt_id', 'quiz', 'questions', 'start_time'}
    assert set(body['quiz']) == {'id', 'title', 'description', 'time_limit', 'passing_score',
                                 'show_answers'}
    assert body['quiz']['id'] == str(quiz.uuid)
    assert [q['type'] for q in body['questions']] == ['multiple_choice', 'true_false',
                                                      'multiple_select', 'fill_blank']
    for question in body['questions']:
        assert set(question) == {'id', 'text', 'type', 'points', 'order', 'options'}
        for option in question['options']:
            assert set(option) == {'id', 'text', 'order'}
    assert body['questions'][3]['options'] == []  # fill in the blank has no options
    assert 'is_correct' not in json.dumps(body)
    assert 'correct_answers' not in json.dumps(body)

    attempt = f.QuizAttempt.objects.get(uuid=body['attempt_id'])
    assert attempt.student_id == student.id
    assert attempt.attempt_number == 1
    assert attempt.end_time is None


def test_start_requires_enrolment_and_a_student(api, auth_client, student, instructor, course_bundle):
    """Anonymous 401, not enrolled / instructor 403, unknown quiz 404."""
    quiz = course_bundle.quiz

    assert start(api, quiz).status_code == 401
    r = start(auth_client(student), quiz)
    assert r.status_code == 403
    assert 'error' in r.json()
    assert start(auth_client(instructor), quiz).status_code == 403
    r = auth_client(student).post(f'/api/assessments/quizzes/{uuid.uuid4()}/attempt/',
                                  {'action': 'start'}, format='json')
    assert r.status_code == 404
    assert f.QuizAttempt.objects.count() == 0


def test_unknown_action_is_rejected(auth_client, student, two_question_quiz):
    """An action other than start / submit is a 400."""
    r = auth_client(student).post(attempt_url(two_question_quiz.quiz), {'action': 'cheat'}, format='json')

    assert r.status_code == 400
    assert 'error' in r.json()


# --------------------------------------------------------------------------- #
# submit / grading
# --------------------------------------------------------------------------- #
def test_submit_all_four_question_types_correct(auth_client, student, four_type_quiz):
    """All four gradable question types answered correctly score 100."""
    quiz = four_type_quiz.quiz
    client = auth_client(student)

    r = play(client, quiz, correct=[0, 1, 2, 3])

    assert r.status_code == 200
    body = r.json()
    assert body['success'] is True
    results = body['results']
    assert set(results) == {'score', 'best_score', 'earned_points', 'total_points', 'passed',
                            'current_attempt_passed', 'passing_score', 'attempt_number',
                            'attempts_remaining'}
    assert results['score'] == pytest.approx(100.0)
    assert results['best_score'] == pytest.approx(100.0)
    assert results['earned_points'] == 4 and results['total_points'] == 4
    assert results['passed'] is True and results['current_attempt_passed'] is True
    assert results['attempt_number'] == 1
    assert results['attempts_remaining'] == quiz.max_attempts - 1

    attempt = f.QuizAttempt.objects.get(quiz=quiz, student=student)
    assert attempt.end_time is not None
    assert attempt.score == Decimal('100')
    assert attempt.passed is True
    responses = f.QuestionResponse.objects.filter(attempt=attempt)
    assert responses.count() == 4
    assert responses.filter(is_correct=True).count() == 4
    assert sum(r.points_earned for r in responses) == 4


def test_submit_half_correct_scores_50_and_fails(auth_client, student, two_question_quiz):
    """1 of 2 correct = 50.0, below the passing score."""
    quiz = two_question_quiz.quiz

    r = play(auth_client(student), quiz, correct=[0])  # 1 of 2

    assert r.status_code == 200
    results = r.json()['results']
    assert results['score'] == pytest.approx(50.0)
    assert results['earned_points'] == 1 and results['total_points'] == 2
    assert results['passed'] is False
    assert results['current_attempt_passed'] is False
    attempt = f.QuizAttempt.objects.get(quiz=quiz, student=student)
    assert attempt.score == Decimal('50')
    assert attempt.passed is False


def test_submit_all_wrong_and_unanswered_score_zero(auth_client, student, four_type_quiz):
    """Wrong or missing answers score 0."""
    quiz = four_type_quiz.quiz
    client = auth_client(student)

    r = play(client, quiz, correct=[])
    assert r.status_code == 200
    assert r.json()['results']['score'] == pytest.approx(0.0)

    # an empty ``answers`` payload is accepted as well
    attempt_id = start(client, quiz).json()['attempt_id']
    r = submit(client, quiz, attempt_id, {})
    assert r.status_code == 200
    assert r.json()['results']['score'] == pytest.approx(0.0)
    responses = f.QuestionResponse.objects.filter(attempt__uuid=attempt_id)
    assert responses.count() == 4
    assert responses.filter(is_correct=False).count() == 4


def test_multiple_select_needs_the_exact_set_and_fill_blank_is_case_insensitive(
        auth_client, instructor, student):
    """Multiple select needs the exact option set; fill-blank ignores case and spaces."""
    bundle = f.build_course(instructor, status='published',
                            quiz_questions=[f.ms_question(), f.fill_question(answers=('Four',))])
    f.enroll(student, bundle.course)
    quiz = bundle.quiz
    ms, fill = quiz.questions.order_by('order')
    client = auth_client(student)

    # a subset of the correct options is not enough ...
    attempt_id = start(client, quiz).json()['attempt_id']
    only_one = str(ms.options.filter(is_correct=True).first().uuid)
    r = submit(client, quiz, attempt_id, {str(ms.uuid): {'selected_options': [only_one]},
                                          str(fill.uuid): {'text_answer': '  fOUR '}})
    assert r.json()['results']['earned_points'] == 1  # ... but "  fOUR " matches "Four"

    # the full set is
    attempt_id = start(client, quiz).json()['attempt_id']
    everything = [str(o.uuid) for o in ms.options.filter(is_correct=True)]
    r = submit(client, quiz, attempt_id, {str(ms.uuid): {'selected_options': everything}})
    assert r.json()['results']['earned_points'] == 1


def test_submit_two_of_three_correct_returns_the_rounded_score(auth_client, instructor, student):
    """2 of 3 correct -> 200 and a score rounded to the two decimals the column stores."""
    bundle = f.build_course(instructor, status='published',
                            quiz_questions=[f.mc_question(), f.tf_question(), f.ms_question()])
    f.enroll(student, bundle.course)
    client = auth_client(student, raise_exceptions=False)

    r = play(client, bundle.quiz, correct=[0, 1])

    assert r.status_code == 200
    assert r.json()['results']['score'] == pytest.approx(66.67, abs=0.005)


def test_a_fractional_score_is_stored_rounded_and_closes_the_attempt(auth_client, instructor, student):
    """2 of 3 correct stores 66.67 (66.666... used to fail validation and left the attempt open)."""
    bundle = f.build_course(instructor, status='published',
                            quiz_questions=[f.mc_question(), f.tf_question(), f.ms_question()])
    f.enroll(student, bundle.course)
    client = auth_client(student)
    attempt_id = start(client, bundle.quiz).json()['attempt_id']

    r = submit(client, bundle.quiz, attempt_id, f.build_answers(bundle.quiz, [0, 1]))

    assert r.status_code == 200
    results = r.json()['results']
    assert (results['earned_points'], results['total_points']) == (2, 3)
    assert results['score'] == pytest.approx(66.67)
    assert results['passed'] is True  # passing score is 60
    attempt = f.QuizAttempt.objects.get(uuid=attempt_id)
    assert attempt.end_time is not None
    assert attempt.score == Decimal('66.67')
    assert f.QuestionResponse.objects.filter(attempt=attempt).count() == 3
    # a finished attempt cannot be submitted again
    assert submit(client, bundle.quiz, attempt_id, f.build_answers(bundle.quiz, [0, 1, 2])).status_code == 400


# --------------------------------------------------------------------------- #
# attempts bookkeeping
# --------------------------------------------------------------------------- #
def test_max_attempts_is_enforced_when_starting(auth_client, instructor, student):
    """Starting more than max_attempts attempts is a 400."""
    bundle = f.build_course(instructor, status='published')
    bundle.quiz.max_attempts = 2
    bundle.quiz.save()
    f.enroll(student, bundle.course)
    client = auth_client(student)

    assert start(client, bundle.quiz).status_code == 200
    assert start(client, bundle.quiz).status_code == 200
    r = start(client, bundle.quiz)

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.QuizAttempt.objects.filter(student=student, quiz=bundle.quiz).count() == 2
    numbers = f.QuizAttempt.objects.filter(student=student).order_by('attempt_number')
    assert [a.attempt_number for a in numbers] == [1, 2]


def test_submit_with_unknown_missing_foreign_or_finished_attempt_is_400(
        auth_client, student, other_student, two_question_quiz):
    """Unknown, missing, foreign or finished attempt ids -> 400."""
    quiz = two_question_quiz.quiz
    f.enroll(other_student, two_question_quiz.course)
    client = auth_client(student)

    r = submit(client, quiz, str(uuid.uuid4()), {})
    assert r.status_code == 400
    assert 'error' in r.json()

    r = client.post(attempt_url(quiz), {'action': 'submit', 'answers': {}}, format='json')
    assert r.status_code == 400

    # somebody else's attempt
    foreign = start(auth_client(other_student), quiz).json()['attempt_id']
    assert submit(client, quiz, foreign, {}).status_code == 400

    # an attempt that was already submitted
    own = start(client, quiz).json()['attempt_id']
    assert submit(client, quiz, own, f.build_answers(quiz, [0, 1])).status_code == 200
    assert submit(client, quiz, own, {}).status_code == 400


def test_submit_with_a_malformed_attempt_id_is_a_400(auth_client, student, two_question_quiz):
    """A non-UUID ``attempt_id`` is as invalid as an unknown one (it used to be a 500)."""
    r = submit(auth_client(student), two_question_quiz.quiz, 'not-a-uuid', {})

    assert r.status_code == 400
    assert 'error' in r.json()


def test_first_attempt_completes_the_lecture_even_when_failed(auth_client, student, two_question_quiz):
    """Completing attempt #1 marks the lecture complete regardless of the score."""
    bundle = two_question_quiz
    client = auth_client(student)
    enrollment = f.Enrollment.objects.get(student=student, course=bundle.course)
    progress = f.LectureProgress.objects.get(enrollment=enrollment, lecture=bundle.quiz_lecture)
    assert progress.is_completed is False

    r = play(client, bundle.quiz, correct=[])  # 0 of 2 - fails but is attempt #1

    assert r.status_code == 200
    assert r.json()['results']['passed'] is False
    progress.refresh_from_db()
    assert progress.is_completed is True
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 25


def test_only_attempt_number_one_completes_the_lecture(auth_client, student, two_question_quiz):
    """Only attempt number 1 auto-completes the lecture."""
    bundle = two_question_quiz
    client = auth_client(student)
    enrollment = f.Enrollment.objects.get(student=student, course=bundle.course)
    first = start(client, bundle.quiz).json()['attempt_id']
    second = start(client, bundle.quiz).json()['attempt_id']
    answers = f.build_answers(bundle.quiz, [0, 1])

    # attempt #2 is submitted first: no auto completion (current behaviour)
    assert submit(client, bundle.quiz, second, answers).status_code == 200
    progress = f.LectureProgress.objects.get(enrollment=enrollment, lecture=bundle.quiz_lecture)
    assert progress.is_completed is False

    assert submit(client, bundle.quiz, first, answers).status_code == 200
    progress.refresh_from_db()
    assert progress.is_completed is True


def test_best_score_and_overall_pass_span_all_attempts(auth_client, student, two_question_quiz):
    """best_score / passed aggregate over all completed attempts."""
    bundle = two_question_quiz
    client = auth_client(student)

    first = play(client, bundle.quiz, correct=[0]).json()['results']  # 50
    second = play(client, bundle.quiz, correct=[0, 1]).json()['results']  # 100
    third = play(client, bundle.quiz, correct=[]).json()['results']  # 0

    assert first['passed'] is False and first['best_score'] == pytest.approx(50.0)
    assert second['passed'] is True and second['best_score'] == pytest.approx(100.0)
    assert third['current_attempt_passed'] is False
    assert third['passed'] is True  # passed on an earlier attempt
    assert third['best_score'] == pytest.approx(100.0)
    assert third['attempt_number'] == 3 and third['attempts_remaining'] == 0

    lecture = [lec for lec in client.get(f'/api/learning/courses/{bundle.course.uuid}/learn/').json()
               ['sections'][0]['lectures'] if lec['content_type'] == 'quiz'][0]
    assert lecture['attempts_taken'] == 3
    assert lecture['best_score'] == pytest.approx(100.0)
    assert lecture['passed'] is True
    assert lecture['can_attempt'] is False


@pytest.mark.pinned_bug
def test_inactive_quiz_can_still_be_attempted_current_behaviour(auth_client, instructor, student):
    """Current behaviour: the live attempt endpoint ignores ``Quiz.is_active``
    (only the grade calculation filters on it)."""
    bundle = f.build_course(instructor, status='published')
    f.Quiz.objects.filter(pk=bundle.quiz.pk).update(is_active=False)
    f.enroll(student, bundle.course)

    r = start(auth_client(student), bundle.quiz)

    assert r.status_code == 200
    assert r.json()['attempt_id']


# --------------------------------------------------------------------------- #
# known gaps that are documented follow-ups (pinned so a refactor keeps them)
# --------------------------------------------------------------------------- #
@pytest.mark.pinned_bug
def test_option_of_another_question_is_accepted_current_behaviour(auth_client, student, two_question_quiz):
    """Current behaviour (security gap): the grader looks the option up by uuid
    only, it never checks that it belongs to the question being answered."""
    quiz = two_question_quiz.quiz
    mc, tf = quiz.questions.order_by('order')
    tf_true = tf.options.get(is_correct=True)
    tf_false = tf.options.get(is_correct=False)
    client = auth_client(student)
    attempt_id = start(client, quiz).json()['attempt_id']

    r = submit(client, quiz, attempt_id, {
        str(mc.uuid): {'selected_option': str(tf_true.uuid)},   # option of the *other* question
        str(tf.uuid): {'selected_option': str(tf_false.uuid)},  # honestly wrong
    })

    assert r.status_code == 200
    assert r.json()['results']['earned_points'] == 1


@pytest.mark.pinned_bug
def test_time_limit_is_not_enforced_on_the_server_current_behaviour(auth_client, instructor, student):
    """A submission long after the time limit is still graded."""
    bundle = f.build_course(instructor, status='published')
    bundle.quiz.time_limit = 1  # one minute
    bundle.quiz.save()
    f.enroll(student, bundle.course)
    client = auth_client(student)
    attempt_id = start(client, bundle.quiz).json()['attempt_id']
    f.QuizAttempt.objects.filter(uuid=attempt_id).update(start_time=timezone.now() - timedelta(days=2))

    r = submit(client, bundle.quiz, attempt_id, f.build_answers(bundle.quiz, [0, 1]))

    assert r.status_code == 200
    assert r.json()['results']['score'] == pytest.approx(100.0)
