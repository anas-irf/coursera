"""Assessment slice: student and instructor gradebooks."""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

STUDENT_GRADEBOOK = '/api/v1/assessments/student/gradebook/'


def instructor_gradebook(course):
    return f'/api/v1/assessments/instructor/courses/{course.uuid}/gradebook/'


GRADE_KEYS = {'final_grade', 'letter_grade', 'components', 'total_weight', 'is_passing'}


@pytest.fixture
def graded(auth_client, instructor, student):
    """Course (quiz weight 40, assignment weight 60); the student scored 80 % on
    the assignment (instructor graded it) and 50 % on the quiz (1 of 2)."""
    bundle = f.build_course(instructor, status='published',
                            quiz_questions=[f.mc_question(), f.tf_question()])
    enrollment = f.enroll(student, bundle.course)

    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment)
    r = auth_client(instructor).post(
        f'/api/v1/assessments/instructor/submissions/{submission.uuid}/grade/',
        {'grade': 80, 'feedback': 'ok'}, format='json')
    assert r.status_code == 200

    client = auth_client(student)
    attempt_id = client.post(f'/api/v1/assessments/quizzes/{bundle.quiz.uuid}/attempt/',
                             {'action': 'start'}, format='json').json()['attempt_id']
    r = client.post(f'/api/v1/assessments/quizzes/{bundle.quiz.uuid}/attempt/', {
        'action': 'submit', 'attempt_id': attempt_id,
        'answers': f.build_answers(bundle.quiz, [0])}, format='json')
    assert r.json()['results']['score'] == pytest.approx(50.0)
    bundle.enrollment = enrollment
    return bundle


def test_student_gradebook_after_graded_assignment_and_quiz_attempt(auth_client, student, instructor, graded):
    """Weighted final grade, letter grade and components for a graded assignment + quiz."""
    r = auth_client(student).get(STUDENT_GRADEBOOK)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'student', 'courses'}
    assert body['student']['email'] == student.email
    assert set(body['student']) == {'id', 'name', 'email'}
    assert len(body['courses']) == 1
    row = body['courses'][0]
    assert {'course_id', 'course_title', 'instructor', 'enrollment_date',
            'progress_percentage'} | GRADE_KEYS <= set(row)
    assert row['course_id'] == str(graded.course.uuid)

    # (80 % * 60 + 50 % * 40) / 100 = 68
    assert row['final_grade'] == pytest.approx(68.0)
    assert row['letter_grade'] == 'D+'
    assert row['is_passing'] is True
    assert row['total_weight'] == pytest.approx(100.0)

    components = {c['type']: c for c in row['components']}
    assert set(components) == {'assignments', 'quizzes'}
    assert components['assignments']['score'] == pytest.approx(80.0)
    assert components['assignments']['weight'] == pytest.approx(60.0)
    assert components['assignments']['completed'] == 1 and components['assignments']['total'] == 1
    assert components['quizzes']['score'] == pytest.approx(50.0)
    assert components['quizzes']['weight'] == pytest.approx(40.0)
    assert components['quizzes']['completed'] == 1 and components['quizzes']['total'] == 1


def test_student_gradebook_without_work_scores_zero(auth_client, instructor, student):
    """No submissions / attempts: 0 %, grade F, not passing."""
    bundle = f.build_course(instructor, status='published')
    f.enroll(student, bundle.course)

    r = auth_client(student).get(STUDENT_GRADEBOOK)

    assert r.status_code == 200
    row = r.json()['courses'][0]
    assert row['final_grade'] == pytest.approx(0.0)
    assert row['letter_grade'] == 'F'
    assert row['is_passing'] is False
    assert [c['completed'] for c in row['components']] == [0, 0]


def test_student_gradebook_is_empty_without_enrolments_and_student_only(
        api, auth_client, student, instructor):
    """No enrolments -> empty list; anonymous 401, instructor 403."""
    r = auth_client(student).get(STUDENT_GRADEBOOK)
    assert r.status_code == 200
    assert r.json()['courses'] == []

    assert api.get(STUDENT_GRADEBOOK).status_code == 401
    assert auth_client(instructor).get(STUDENT_GRADEBOOK).status_code == 403


def test_instructor_gradebook_lists_students_and_statistics(auth_client, instructor, student,
                                                            other_student, graded):
    """Per-student rows plus course statistics and grade distribution."""
    f.enroll(other_student, graded.course)  # no work at all -> 0

    r = auth_client(instructor).get(instructor_gradebook(graded.course))

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'course', 'students', 'statistics'}
    assert body['course'] == {'id': str(graded.course.uuid), 'title': graded.course.title,
                              'instructor': f'{instructor.first_name} {instructor.last_name}'}

    rows = {row['student_email']: row for row in body['students']}
    assert set(rows) == {student.email, other_student.email}
    mine = rows[student.email]
    assert {'student_id', 'student_name', 'student_email', 'enrollment_date',
            'progress_percentage'} | GRADE_KEYS <= set(mine)
    assert mine['final_grade'] == pytest.approx(68.0)
    assert rows[other_student.email]['final_grade'] == pytest.approx(0.0)
    assert rows[other_student.email]['letter_grade'] == 'F'

    stats = body['statistics']
    assert set(stats) == {'total_students', 'average_grade', 'highest_grade', 'lowest_grade',
                          'passing_students', 'failing_students', 'grade_distribution'}
    assert stats['total_students'] == 2
    assert stats['highest_grade'] == pytest.approx(68.0)
    assert stats['lowest_grade'] == pytest.approx(0.0)
    assert stats['average_grade'] == pytest.approx(34.0)
    assert stats['passing_students'] == 1 and stats['failing_students'] == 1
    assert stats['grade_distribution'] == {'A': 0, 'B': 0, 'C': 0, 'D': 1, 'F': 1}


def test_instructor_gradebook_of_a_course_without_students(auth_client, instructor):
    """No students: empty list and ``statistics`` null."""
    course = f.build_course(instructor, status='published').course

    r = auth_client(instructor).get(instructor_gradebook(course))

    assert r.status_code == 200
    assert r.json()['students'] == []
    assert r.json()['statistics'] is None


def test_instructor_gradebook_is_for_instructors_only(api, auth_client, student, graded):
    """Anonymous 401 and students 403."""
    url = instructor_gradebook(graded.course)

    assert api.get(url).status_code == 401
    assert auth_client(student).get(url).status_code == 403


def test_instructor_gradebook_of_a_foreign_course_is_a_404(auth_client, other_instructor, graded):
    """Somebody else's course does not exist for you (it used to be a 500)."""
    r = auth_client(other_instructor).get(instructor_gradebook(graded.course))

    assert r.status_code == 404
