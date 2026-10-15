"""Quiz grading and assignment services (refactor step S8)."""
from decimal import Decimal

import pytest

import factories as f
from apps.assessments.services import assignments, quizzes
from apps.core.api.errors import NotFound, PermissionDenied, ServiceError

pytestmark = pytest.mark.django_db


@pytest.fixture
def quiz_bundle(instructor):
    return f.build_course(instructor, status='published',
                          quiz_questions=[f.mc_question(), f.tf_question(), f.ms_question(),
                                          f.fill_question()])


def _questions(bundle):
    return {q.question_type: q for q in bundle.quiz.questions.order_by('order')}


# --------------------------------------------------------------------------- #
# grading one answer
# --------------------------------------------------------------------------- #
def test_single_choice_is_correct_only_for_the_correct_option(quiz_bundle):
    question = _questions(quiz_bundle)['multiple_choice']
    right = question.options.get(is_correct=True)
    wrong = question.options.filter(is_correct=False).first()

    assert quizzes.is_correct(question, {'selected_option': str(right.uuid)}) is True
    assert quizzes.is_correct(question, {'selected_option': str(wrong.uuid)}) is False
    assert quizzes.is_correct(question, {}) is False
    assert quizzes.is_correct(question, None) is False


def test_multiple_select_needs_exactly_the_correct_set(quiz_bundle):
    question = _questions(quiz_bundle)['multiple_select']
    right = [str(o.uuid) for o in question.options.filter(is_correct=True)]
    wrong = str(question.options.filter(is_correct=False).first().uuid)

    assert quizzes.is_correct(question, {'selected_options': right}) is True
    assert quizzes.is_correct(question, {'selected_options': right[:-1]}) is False
    assert quizzes.is_correct(question, {'selected_options': right + [wrong]}) is False


def test_fill_blank_ignores_case_and_surrounding_spaces(quiz_bundle):
    question = _questions(quiz_bundle)['fill_blank']
    question.correct_answers = ['Four', ' 4 ']
    question.save()

    assert quizzes.is_correct(question, {'text_answer': '  FOUR '}) is True
    assert quizzes.is_correct(question, {'text_answer': '4'}) is True
    assert quizzes.is_correct(question, {'text_answer': 'five'}) is False


def test_essay_questions_are_never_auto_graded(quiz_bundle):
    question = _questions(quiz_bundle)['multiple_choice']
    question.question_type = 'essay'

    assert quizzes.is_correct(question, {'text_answer': 'anything'}) is False


# --------------------------------------------------------------------------- #
# scores
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('earned, total, expected', [
    (0, 0, '0.00'),
    (0, 5, '0.00'),
    (1, 3, '33.33'),
    (2, 3, '66.67'),
    (5, 5, '100.00'),
    (1, 8, '12.50'),
    (1, 6, '16.67'),
])
def test_percentage_is_rounded_to_two_places(earned, total, expected):
    assert quizzes._percentage(earned, total) == Decimal(expected)


def test_passing_uses_the_stored_rounded_score(auth_client, instructor, student):
    """59.996 % is stored as 60.00, so it must pass a passing score of 60."""
    questions = [f.mc_question(points=1) for _ in range(2)] + [f.mc_question(points=1)]
    bundle = f.build_course(instructor, status='published', quiz_questions=questions)
    bundle.quiz.passing_score = 67
    bundle.quiz.save()
    enrollment = f.enroll(student, bundle.course)
    attempt = quizzes.start_attempt(student, bundle.quiz, enrollment)
    answers = f.build_answers(bundle.quiz, [0, 1])  # 2 of 3 -> 66.67 < 67

    results = quizzes.submit_attempt(student, bundle.quiz, enrollment, attempt.uuid, answers)

    assert results['score'] == pytest.approx(66.67)
    assert results['current_attempt_passed'] is False
    assert results['attempts_remaining'] == bundle.quiz.max_attempts - 1


def test_best_score_and_overall_pass_span_all_attempts(instructor, student):
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)

    first = quizzes.start_attempt(student, bundle.quiz, enrollment)
    quizzes.submit_attempt(student, bundle.quiz, enrollment, first.uuid,
                           f.build_answers(bundle.quiz, [0, 1]))
    second = quizzes.start_attempt(student, bundle.quiz, enrollment)
    results = quizzes.submit_attempt(student, bundle.quiz, enrollment, second.uuid,
                                     f.build_answers(bundle.quiz, []))

    assert results['score'] == 0.0
    assert results['best_score'] == 100.0
    assert results['passed'] is True               # passed on the first attempt
    assert results['current_attempt_passed'] is False


def test_unknown_attempts_are_rejected(instructor, student):
    bundle = f.build_course(instructor, status='published')
    enrollment = f.enroll(student, bundle.course)

    for bad in (None, '', 'not-a-uuid', '00000000-0000-0000-0000-000000000000'):
        with pytest.raises(ServiceError, match='Invalid or completed attempt'):
            quizzes.submit_attempt(student, bundle.quiz, enrollment, bad, {})


# --------------------------------------------------------------------------- #
# assignments
# --------------------------------------------------------------------------- #
@pytest.fixture
def assignment_setup(instructor, student):
    bundle = f.build_course(instructor, status='published')
    return bundle, f.enroll(student, bundle.course)


def test_submit_requires_an_active_enrolment(instructor, other_student, assignment_setup):
    bundle, _ = assignment_setup

    with pytest.raises(PermissionDenied):
        assignments.submit(other_student, bundle.assignment, 'text', None)


def test_submit_needs_text_or_a_file_and_only_once(student, assignment_setup):
    bundle, _ = assignment_setup

    with pytest.raises(ServiceError, match='either text submission or upload a file'):
        assignments.submit(student, bundle.assignment, '   ', None)

    submission = assignments.submit(student, bundle.assignment, 'my work', None)
    assert submission.is_late is False

    with pytest.raises(ServiceError, match='already submitted'):
        assignments.submit(student, bundle.assignment, 'again', None)


def test_submitting_completes_the_assignment_lecture(student, assignment_setup):
    bundle, enrollment = assignment_setup

    assignments.submit(student, bundle.assignment, 'my work', None)

    assert f.LectureProgress.objects.get(
        enrollment=enrollment, lecture=bundle.assignment.lecture).is_completed is True


@pytest.mark.parametrize('value, message', [
    (None, 'Grade is required'),
    ('abc', 'valid number'),
    ([], 'valid number'),
    ('nan', 'valid number'),
    ('inf', 'valid number'),
    (-1, 'between 0 and'),
    (101, 'between 0 and'),
])
def test_grade_validation(instructor, student, assignment_setup, value, message):
    bundle, enrollment = assignment_setup
    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment)

    with pytest.raises(ServiceError, match=message):
        assignments.grade(submission, instructor, value, 'feedback')

    submission.refresh_from_db()
    assert submission.grade is None


def test_grade_stores_trimmed_feedback_and_the_grader(instructor, student, assignment_setup):
    bundle, enrollment = assignment_setup
    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment)

    graded = assignments.grade(submission, instructor, '87.5', '  well done  ')

    assert graded.grade == Decimal('87.50')
    assert graded.feedback == 'well done'
    assert graded.graded_by == instructor
    assert graded.graded_at is not None


def test_only_owner_and_course_instructor_can_read_a_submission(
        student, other_student, instructor, other_instructor, admin, assignment_setup):
    bundle, enrollment = assignment_setup
    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment)

    for user in (student, instructor):
        assert assignments.readable_submission(user, submission.uuid) == submission
    for user in (other_student, other_instructor, admin):
        with pytest.raises(NotFound):
            assignments.readable_submission(user, submission.uuid)


def test_a_submission_without_a_file_has_nothing_to_download(student, assignment_setup):
    bundle, enrollment = assignment_setup
    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment)

    with pytest.raises(NotFound, match='No file attached'):
        assignments.read_submission_file(submission)
