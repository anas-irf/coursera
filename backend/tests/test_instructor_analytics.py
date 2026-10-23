"""The instructor's analytics page: learners, completion, quiz results and earnings of their courses."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

ANALYTICS = '/api/v1/insights/instructor/analytics/'


def finished_attempt(bundle, student, enrollment, score, *, passed):
    return f.QuizAttempt.objects.create(student=student, quiz=bundle.quiz, enrollment=enrollment,
                                        score=Decimal(score), passed=passed, end_time=timezone.now())


@pytest.fixture
def world(instructor, other_instructor):
    """A Plus course with three learners, a draft, and another instructor's course that must not count."""
    plus = f.build_course(instructor, course_type='coursera_plus', title='Applied Statistics',
                          average_rating=Decimal('4.60'), total_reviews=20)
    draft = f.make_course(instructor, title='Draft course')
    foreign = f.build_course(other_instructor, title='Somebody else')

    done, halfway, new = f.make_student(), f.make_student(), f.make_student()
    now = timezone.now()
    finished = f.enroll(done, plus.course, status='completed')
    f.Enrollment.objects.filter(pk=finished.pk).update(
        progress_percentage=100, completed_date=now, last_accessed=now - timedelta(days=1))
    middle = f.enroll(halfway, plus.course)
    f.Enrollment.objects.filter(pk=middle.pk).update(progress_percentage=60, last_accessed=now - timedelta(days=10))
    f.enroll(new, plus.course)

    finished_attempt(plus, done, finished, 100, passed=True)
    finished_attempt(plus, halfway, middle, 40, passed=False)
    f.QuizAttempt.objects.create(student=new, quiz=plus.quiz, enrollment=f.Enrollment.objects.get(student=new),
                                 score=None)                       # still open: not counted
    f.make_submission(plus.assignment, done, grade=Decimal('80'))
    f.make_submission(plus.assignment, halfway)

    f.make_earning(instructor, plus.course, amount=Decimal('120.50'), is_paid=False)
    f.make_earning(instructor, plus.course, month=(timezone.localdate().replace(day=1) - timedelta(days=1)).replace(day=1),
                   amount=Decimal('80.00'), is_paid=True)

    stranger = f.make_student()
    f.enroll(stranger, foreign.course)
    f.make_earning(other_instructor, foreign.course, amount=Decimal('999.00'))
    return {'plus': plus, 'draft': draft}


def test_the_totals_count_only_the_instructors_own_courses(auth_client, instructor, world):
    body = auth_client(instructor).get(ANALYTICS).json()

    assert set(body) == {'months', 'totals', 'monthly', 'progress_distribution', 'courses'}
    assert body['totals'] == {
        'courses': 2, 'published_courses': 1,
        'students': 3, 'enrollments': 3, 'active_learners': 1,
        'completions': 1, 'completion_rate': 33.3, 'average_progress': 53.3,
        'quiz_attempts': 2, 'average_quiz_score': 70.0, 'quiz_pass_rate': 50.0,
        'submissions': 2, 'pending_submissions': 1,
        'earnings': 200.5, 'average_rating': 4.6,
    }


def test_the_months_are_charted_oldest_first_with_the_current_one_last(auth_client, instructor, world):
    body = auth_client(instructor).get(ANALYTICS).json()

    assert body['months'] == 6 and len(body['monthly']) == 6
    current, previous = body['monthly'][-1], body['monthly'][-2]
    assert current['month'] == timezone.localdate().strftime('%Y-%m')
    assert set(current) == {'month', 'label', 'enrollments', 'completions', 'earnings'}
    assert (current['enrollments'], current['completions'], current['earnings']) == (3, 1, 120.5)
    assert previous['earnings'] == 80.0


def test_the_learners_are_split_by_how_far_they_are(auth_client, instructor, world):
    distribution = auth_client(instructor).get(ANALYTICS).json()['progress_distribution']

    assert [(row['key'], row['count']) for row in distribution] == [
        ('not_started', 1), ('under_half', 0), ('over_half', 1), ('completed', 1)]


def test_every_course_has_a_row_most_learners_first(auth_client, instructor, world):
    courses = auth_client(instructor).get(ANALYTICS).json()['courses']

    assert [row['title'] for row in courses] == ['Applied Statistics', 'Draft course']
    plus, draft = courses
    assert plus['id'] == str(world['plus'].course.uuid)
    assert (plus['enrollments'], plus['completions'], plus['active_learners']) == (3, 1, 1)
    assert (plus['completion_rate'], plus['average_progress'], plus['average_quiz_score']) == (33.3, 53.3, 70.0)
    assert (plus['average_rating'], plus['total_reviews'], plus['revenue']) == (4.6, 20, 200.5)
    assert plus['course_type'] == 'coursera_plus' and plus['status'] == 'published'
    # nothing to average is not a zero
    assert draft['completion_rate'] is None and draft['average_progress'] is None
    assert draft['average_quiz_score'] is None and draft['average_rating'] is None
    assert draft['revenue'] == 0.0


def test_an_instructor_without_courses_sees_empty_figures(auth_client):
    newcomer = f.make_instructor()

    body = auth_client(newcomer).get(ANALYTICS).json()

    assert body['totals']['courses'] == 0 and body['totals']['earnings'] == 0.0
    assert body['totals']['completion_rate'] is None and body['totals']['average_rating'] is None
    assert body['courses'] == []
    assert all(row['enrollments'] == 0 for row in body['monthly'])


@pytest.mark.parametrize('months', [3, 6, 12])
def test_the_period_is_three_six_or_twelve_months(auth_client, instructor, months):
    body = auth_client(instructor).get(ANALYTICS, {'months': months}).json()

    assert body['months'] == months and len(body['monthly']) == months


@pytest.mark.parametrize('months', ['5', 'many', '0'])
def test_another_period_is_a_400(auth_client, instructor, months):
    r = auth_client(instructor).get(ANALYTICS, {'months': months})

    assert r.status_code == 400 and 'months' in r.json()['error']


def test_only_instructors_see_analytics(api, auth_client, student, admin):
    assert api.get(ANALYTICS).status_code == 401
    assert auth_client(student).get(ANALYTICS).status_code == 403
    assert auth_client(admin).get(ANALYTICS).status_code == 403
