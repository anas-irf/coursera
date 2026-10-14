"""Insight / recognition slices: dashboards, earnings, student statistics,
achievements, certificates and the instructor roster / per-course analytics.

Each endpoint is pinned by its documented top-level keys (and a few values)
rather than by its entire payload.
"""
import calendar
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

DASHBOARD = '/api/v1/insights/instructor/dashboard/'
EARNINGS = '/api/v1/insights/instructor/earnings/'
STUDENT_STATS = '/api/v1/insights/student/stats/'
WEEKLY = '/api/v1/insights/student/weekly-progress/'
ACHIEVEMENTS = '/api/v1/insights/student/achievements/'
CERTIFICATES = '/api/v1/certificates/'
ROSTER = '/api/v1/learning/instructor/students/'


def course_url(course, action):
    prefix = {'students': 'learning', 'analytics': 'insights'}[action]
    return f'/api/v1/{prefix}/instructor/courses/{course.uuid}/{action}/'


# --------------------------------------------------------------------------- #
# instructor dashboard
# --------------------------------------------------------------------------- #
def test_instructor_dashboard_top_level_keys(api, auth_client, instructor, student):
    """Dashboard keys: stats, recent_enrollments, revenue_chart, top_courses."""
    course = f.make_course(instructor, status='published')
    f.enroll(student, course)

    r = auth_client(instructor).get(DASHBOARD)

    assert r.status_code == 200
    body = r.json()
    assert {'stats', 'recent_enrollments', 'revenue_chart', 'top_courses'} <= set(body)
    assert set(body['stats']) == {'total_courses', 'total_students', 'total_revenue',
                                  'average_rating', 'published_courses', 'draft_courses'}
    assert isinstance(body['recent_enrollments'], list)
    assert isinstance(body['revenue_chart'], list)
    assert isinstance(body['top_courses'], list)

    assert api.get(DASHBOARD).status_code == 401
    assert auth_client(student).get(DASHBOARD).status_code == 403


def test_instructor_dashboard_is_populated(auth_client, instructor, student):
    """Counts, recent enrolments and top courses reflect the data (the view used to
    fail on an invalid lookup and always answered with an all-zero fallback)."""
    course = f.make_course(instructor, status='published', title='Popular')
    f.make_course(instructor, status='draft', title='Draft one')
    f.enroll(student, course)

    body = auth_client(instructor).get(DASHBOARD).json()

    assert 'error' not in body
    assert body['stats']['total_courses'] == 2
    assert body['stats']['published_courses'] == 1
    assert body['stats']['draft_courses'] == 1
    assert body['stats']['total_students'] == 1
    assert body['stats']['total_revenue'] == 0  # nothing creates earnings yet
    (recent,) = body['recent_enrollments']
    assert recent['student_email'] == student.email
    assert recent['course_title'] == 'Popular'
    assert len(body['revenue_chart']) == 30
    assert {row['title'] for row in body['top_courses']} == {'Popular', 'Draft one'}


def test_dashboard_ranks_courses_by_revenue_and_charts_recent_earnings(auth_client, instructor):
    cheap = f.make_course(instructor, status='published', title='Cheap')
    best = f.make_course(instructor, status='published', title='Best')
    f.make_course(instructor, status='published', title='Unpaid')
    f.make_earning(instructor, cheap, amount=Decimal('10.00'))
    f.make_earning(instructor, best, amount=Decimal('90.00'))

    body = auth_client(instructor).get(DASHBOARD).json()

    assert [row['title'] for row in body['top_courses']][:2] == ['Best', 'Cheap']
    assert body['top_courses'][0]['total_revenue'] == pytest.approx(90.0)
    assert body['stats']['total_revenue'] == pytest.approx(100.0)
    assert sum(point['revenue'] for point in body['revenue_chart']) == pytest.approx(100.0)


# --------------------------------------------------------------------------- #
# instructor earnings
# --------------------------------------------------------------------------- #
def test_instructor_earnings_payload(api, auth_client, instructor, student):
    """Earnings payload keys and values; simulated transactions; instructor only."""
    course = f.make_course(instructor, status='published', level='advanced')
    f.enroll(student, course)
    f.make_earning(instructor, course, amount=Decimal('25.00'), is_paid=True)

    r = auth_client(instructor).get(EARNINGS)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'summary', 'recent_transactions', 'monthly_chart', 'performance',
                         'recent_earnings', 'earnings_model'}
    assert set(body['summary']) == {'total_earnings', 'pending_earnings', 'monthly_earnings',
                                    'platform_fee_rate'}
    assert body['summary']['total_earnings'] == pytest.approx(25.0)
    assert body['summary']['pending_earnings'] == pytest.approx(0.0)
    assert body['summary']['monthly_earnings'] == pytest.approx(25.0)

    assert len(body['monthly_chart']) == 6
    assert set(body['monthly_chart'][0]) == {'month', 'earnings'}
    assert set(body['performance']) == {'monthly_enrollments', 'monthly_completions',
                                        'engagement_score'}
    assert body['performance']['monthly_enrollments'] == 2

    (earning,) = body['recent_earnings']
    assert set(earning) == {'id', 'month', 'course', 'enrollments', 'completions',
                            'engagement_score', 'amount', 'multiplier', 'status'}
    assert earning['status'] == 'Paid'
    assert earning['amount'] == pytest.approx(25.0)

    # "transactions" are simulated from enrolments
    (transaction,) = body['recent_transactions']
    assert set(transaction) == {'date', 'course', 'student_email', 'amount', 'status'}
    assert transaction['student_email'] == student.email

    assert api.get(EARNINGS).status_code == 401
    r = auth_client(student).get(EARNINGS)
    assert r.status_code == 403
    assert 'detail' in r.json()  # the permission class answers, like on every other route


def test_instructor_earnings_for_an_instructor_without_earnings(auth_client, instructor):
    """No earnings rows: zeros and empty lists."""
    body = auth_client(instructor).get(EARNINGS).json()

    assert body['summary']['total_earnings'] == 0
    assert body['recent_earnings'] == []
    assert body['recent_transactions'] == []
    assert len(body['monthly_chart']) == 6


# --------------------------------------------------------------------------- #
# student statistics
# --------------------------------------------------------------------------- #
def test_student_stats_payload(api, auth_client, instructor, student):
    """Student stats keys and counters; Plus flag; student only."""
    first = f.build_course(instructor, status='published')
    second = f.build_course(instructor, status='published')
    f.enroll(student, first.course)
    f.enroll(student, second.course)
    client = auth_client(student)
    assert client.post(f'/api/v1/learning/courses/{first.course.uuid}/lectures/{first.video.uuid}/complete/'
                       ).status_code == 200

    r = client.get(STUDENT_STATS)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'courses_enrolled', 'courses_active', 'courses_completed',
                         'certificates_earned', 'total_progress', 'has_plus_subscription',
                         'learning_streak', 'total_learning_hours'}
    assert body['courses_enrolled'] == 2
    assert body['courses_active'] == 2
    assert body['courses_completed'] == 0
    assert body['certificates_earned'] == 0
    assert body['has_plus_subscription'] is False
    assert body['total_progress'] == pytest.approx(12.5)  # (25 + 0) / 2

    f.give_plus(student)
    assert client.get(STUDENT_STATS).json()['has_plus_subscription'] is True

    assert api.get(STUDENT_STATS).status_code == 401
    assert auth_client(instructor).get(STUDENT_STATS).status_code == 403


def test_student_stats_counts_completed_courses_and_issued_certificates(auth_client, instructor, student):
    """Completed enrolments and issued certificates are counted."""
    course = f.make_course(instructor, status='published')
    enrollment = f.enroll(student, course, status='completed')
    f.Enrollment.objects.filter(pk=enrollment.pk).update(certificate_issued=True)

    body = auth_client(student).get(STUDENT_STATS).json()

    assert body['courses_completed'] == 1
    assert body['courses_active'] == 0
    assert body['certificates_earned'] == 1


def months_back(day, back):
    """The first day of the month ``back`` months before ``day``'s."""
    index = day.year * 12 + day.month - 1 - back
    return date(index // 12, index % 12 + 1, 1)


def test_student_weekly_progress_charts_the_hours_logged_per_month(auth_client, student, instructor):
    """Four calendar months, oldest first; the hours are what the learning log holds."""
    today = timezone.localdate()
    client = auth_client(student)

    empty = client.get(WEEKLY).json()['monthly_progress']
    assert [row['hours'] for row in empty] == [0, 0, 0, 0]

    f.log_learning(student, days_ago=0, seconds=2 * 3600)
    f.log_learning(student, days_ago=(today - (months_back(today, 0) - timedelta(days=1))).days,
                   seconds=int(3.5 * 3600))
    f.log_learning(student, days_ago=(today - months_back(today, 4)).days, seconds=9 * 3600)

    r = client.get(WEEKLY)

    assert r.status_code == 200
    rows = r.json()['monthly_progress']
    assert [set(row) for row in rows] == [{'month', 'hours'}] * 4
    assert [row['month'] for row in rows] == [
        calendar.month_abbr[months_back(today, back).month] for back in (3, 2, 1, 0)]
    assert [row['hours'] for row in rows] == [0, 0, 3.5, 2.0]   # the fifth month back is outside

    assert auth_client(instructor).get(WEEKLY).status_code == 403


def test_student_streak_counts_consecutive_days_and_a_day_that_has_not_begun_does_not_break_it(
        auth_client, student):
    client = auth_client(student)
    assert client.get(STUDENT_STATS).json()['learning_streak'] == 0

    for days_ago in (1, 2, 3, 5):        # the fifth day back is separated by a gap
        f.log_learning(student, days_ago=days_ago)
    assert client.get(STUDENT_STATS).json()['learning_streak'] == 3

    f.log_learning(student, days_ago=0)
    assert client.get(STUDENT_STATS).json()['learning_streak'] == 4


def test_student_hours_are_the_sum_of_the_log(auth_client, student):
    f.log_learning(student, days_ago=0, seconds=5400)
    f.log_learning(student, days_ago=40, seconds=1800)

    assert auth_client(student).get(STUDENT_STATS).json()['total_learning_hours'] == 2.0


# --------------------------------------------------------------------------- #
# achievements / certificates
# --------------------------------------------------------------------------- #
def test_student_achievements_payload(auth_client, instructor, student):
    """Achievements payload keys, points per lesson, first achievement."""
    bundle = f.build_course(instructor, status='published')
    f.enroll(student, bundle.course)
    client = auth_client(student)

    empty = client.get(ACHIEVEMENTS).json()
    assert set(empty) == {'total_points', 'current_level', 'next_level_points', 'global_rank',
                          'monthly_rank', 'achievements'}
    assert empty['total_points'] == 0
    assert empty['current_level'] == 0
    assert empty['next_level_points'] == 250
    assert len(empty['achievements']) == 6
    for item in empty['achievements']:
        assert {'id', 'title', 'description', 'icon', 'earned', 'progress'} <= set(item)
    assert [a['earned'] for a in empty['achievements']].count(True) == 0

    client.post(f'/api/v1/learning/courses/{bundle.course.uuid}/lectures/{bundle.video.uuid}/complete/')
    after = client.get(ACHIEVEMENTS).json()
    assert after['total_points'] == 5  # 5 points per completed lesson
    first_steps = [a for a in after['achievements'] if a['title'] == 'First Steps'][0]
    assert first_steps['earned'] is True


def test_ranks_follow_the_time_learned(auth_client, student, other_student):
    third = f.make_student()
    f.log_learning(student, seconds=10 * 3600)
    f.log_learning(other_student, seconds=5 * 3600)
    f.log_learning(other_student, days_ago=70, seconds=20 * 3600)   # long ago: counts overall only

    bodies = [auth_client(user).get(ACHIEVEMENTS).json() for user in (student, other_student, third)]

    assert [body['global_rank'] for body in bodies] == [2, 1, 3]
    # nobody ranks in a month they did not learn in
    assert [body['monthly_rank'] for body in bodies] == [1, 2, None]


def test_a_badge_is_earned_exactly_when_its_progress_is_complete_and_then_has_a_real_date(
        auth_client, instructor, student):
    course = f.make_course(instructor, status='published')
    section = f.make_section(course)
    lectures = [f.make_reading(section) for _ in range(10)]
    f.enroll(student, course)
    client = auth_client(student)
    for lecture in lectures[:9]:
        client.post(f'/api/v1/learning/courses/{course.uuid}/lectures/{lecture.uuid}/complete/')
    for day in range(7):
        f.log_learning(student, days_ago=day)

    def badges():
        return {a['title']: a for a in client.get(ACHIEVEMENTS).json()['achievements']}

    before = badges()
    assert before['Dedicated Learner']['earned'] is False
    assert before['Dedicated Learner']['progress'] == 90
    assert before['Dedicated Learner']['date'] is None
    assert before['Quiz Master']['earned'] is False and before['Quiz Master']['date'] is None

    client.post(f'/api/v1/learning/courses/{course.uuid}/lectures/{lectures[9].uuid}/complete/')

    after = badges()
    today = timezone.localdate().isoformat()
    assert after['Dedicated Learner']['earned'] is True
    assert after['Dedicated Learner']['date'] == today
    assert after['First Steps']['date'] == today
    assert after['Week Warrior']['earned'] is True and after['Week Warrior']['date'] == today
    for item in after.values():
        assert item['earned'] == (item['progress'] >= 100)


def test_student_certificates_listing(api, auth_client, instructor, student, other_student):
    """Certificates are listed per student with the documented keys."""
    course = f.make_course(instructor, status='published', title='Certified course')
    enrollment = f.enroll(student, course, status='completed')
    cert = f.make_certificate(enrollment, grade=Decimal('95.50'))
    other_enrollment = f.enroll(other_student, course, status='completed')
    f.make_certificate(other_enrollment)

    r = auth_client(student).get(CERTIFICATES)

    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    row = rows[0]
    assert set(row) == {'id', 'course_title', 'instructor', 'issue_date', 'certificate_id',
                        'verification_url', 'grade', 'thumbnail'}
    assert row['id'] == str(cert.uuid)
    assert row['course_title'] == 'Certified course'
    assert row['certificate_id'] == cert.certificate_number
    assert row['grade'] == pytest.approx(95.5)
    assert row['verification_url'].endswith(cert.verification_code)

    assert auth_client(other_student).get(CERTIFICATES).json()[0]['id'] != row['id']
    assert api.get(CERTIFICATES).status_code == 401
    assert auth_client(instructor).get(CERTIFICATES).status_code == 403


@pytest.mark.pinned_bug
def test_certificate_model_cannot_generate_its_own_number_current_behaviour(instructor, student):
    """Current behaviour (bug): ``Certificate.save()`` builds the number from
    ``course.id[:8]`` - slicing an integer - so a certificate can only be stored
    with explicit ``certificate_number`` / ``verification_code`` values."""
    course = f.make_course(instructor, status='published')
    enrollment = f.enroll(student, course, status='completed')

    with pytest.raises(TypeError):
        f.Certificate.objects.create(enrollment=enrollment, student=student, course=course,
                                     completion_date=timezone.now())


# --------------------------------------------------------------------------- #
# instructor roster / per-course statistics
# --------------------------------------------------------------------------- #
def test_instructor_course_students_action(auth_client, instructor, student, other_student):
    """Per-course student list keys and statuses."""
    course = f.make_course(instructor, status='published')
    f.enroll(student, course)
    f.enroll(other_student, course, status='completed')

    r = auth_client(instructor).get(course_url(course, 'students'))

    assert r.status_code == 200
    rows = {row['email']: row for row in r.json()}
    assert set(rows) == {student.email, other_student.email}
    assert set(rows[student.email]) == {'id', 'name', 'email', 'enrolled_date', 'progress',
                                        'last_accessed', 'status'}
    assert rows[student.email]['id'] == str(student.uuid)
    assert rows[student.email]['status'] == 'active'
    assert rows[other_student.email]['status'] == 'completed'


def test_instructor_course_analytics_action(auth_client, instructor, student, other_student):
    """Per-course analytics: totals, active students, completion rate, average progress."""
    course = f.make_course(instructor, status='published')
    active = f.enroll(student, course)
    done = f.enroll(other_student, course, status='completed')
    f.Enrollment.objects.filter(pk=active.pk).update(last_accessed=timezone.now(),
                                                     progress_percentage=40)
    f.Enrollment.objects.filter(pk=done.pk).update(last_accessed=timezone.now() - timedelta(days=30),
                                                   progress_percentage=100)

    r = auth_client(instructor).get(course_url(course, 'analytics'))

    assert r.status_code == 200
    body = r.json()
    assert {'total_students', 'active_students', 'completion_rate', 'average_progress',
            'total_revenue'} <= set(body)
    assert body['total_students'] == 2
    assert body['active_students'] == 1  # touched within the last 7 days
    assert body['completion_rate'] == pytest.approx(50.0)
    assert body['average_progress'] == pytest.approx(70.0)
    assert body['total_revenue'] == pytest.approx(0.0)


def test_instructor_roster_groups_students_across_courses(api, auth_client, instructor, other_instructor,
                                                          student, other_student):
    """The roster groups a student across the instructor's courses."""
    one = f.make_course(instructor, status='published', title='One')
    two = f.make_course(instructor, status='published', title='Two')
    elsewhere = f.make_course(other_instructor, status='published', title='Elsewhere')
    f.enroll(student, one)
    f.enroll(student, two)
    f.enroll(other_student, one)
    f.enroll(other_student, elsewhere)

    r = auth_client(instructor).get(ROSTER)

    assert r.status_code == 200
    rows = {row['email']: row for row in r.json()}
    assert set(rows) == {student.email, other_student.email}
    row = rows[student.email]
    assert set(row) == {'id', 'name', 'email', 'avatar', 'courses_enrolled', 'progress',
                        'last_active', 'enrolled_date', 'status', 'courses_enrolled_count'}
    assert row['courses_enrolled_count'] == 2
    assert row['courses_enrolled'] == '2 courses'  # a display string, not a list
    assert rows[other_student.email]['courses_enrolled_count'] == 1  # only this instructor's course

    assert api.get(ROSTER).status_code == 401
    assert auth_client(student).get(ROSTER).status_code == 403
