"""Instructor earnings: the pool is a share of what students paid, and it is conserved.

``calculate_earnings`` is run for a finished month: 40 % of the month's completed Coursera Plus
payments is shared among the Plus courses that month's learners enrolled in, in proportion to
their enrollments times a performance multiplier, normalised so the amounts add up to the pool
to the cent.  A month is calculated once and then frozen.
"""
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

EARNINGS = '/api/v1/insights/instructor/earnings/'


def previous_month(today=None):
    first = (today or timezone.now().date()).replace(day=1)
    return (first - timedelta(days=1)).replace(day=1)


def month_label(month):
    return f'{month:%Y-%m}'


def at(month, day=10):
    return datetime.combine(month.replace(day=day), time(12), tzinfo=UTC)


def pay(student, month, amount='49.99', *, status='completed', day=10, reference=None):
    """A Plus payment dated in ``month``."""
    subscription = f.get_subscription(student) or f.give_plus(student)
    payment = f.StudentPlusPayment.objects.create(
        subscription=subscription, amount=Decimal(amount), status=status, payment_method='stripe',
        transaction_id=reference or f'pi_{student.pk}_{month:%Y%m}_{status}_{day}')
    f.StudentPlusPayment.objects.filter(pk=payment.pk).update(payment_date=at(month, day))
    return payment


def plus_course(instructor, title='Plus course'):
    return f.make_course(instructor, status='published', course_type='coursera_plus', title=title)


def enrol(student, course, month, *, status='active', day=5):
    enrollment = f.enroll(student, course)
    f.Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_date=at(month, day), status=status)
    return enrollment


def run(*args):
    out = StringIO()
    call_command('calculate_earnings', *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def students():
    return [f.make_student() for _ in range(6)]


# --------------------------------------------------------------------------- #
# the pool
# --------------------------------------------------------------------------- #
def test_the_pool_is_the_instructors_share_of_the_months_completed_payments(
        instructor, students, other_student):
    month = previous_month()
    course = plus_course(instructor)
    enrol(students[0], course, month)
    pay(students[0], month, '49.99')
    pay(students[1], month, '399.99')
    pay(students[2], month, '49.99', status='failed')        # not money
    pay(students[3], month, '49.99', status='refunded')      # given back
    pay(students[4], previous_month(month), '49.99')         # another month

    run('--month', month_label(month))

    pool = f.CourseraRevenuePool.objects.get(month=month)
    assert pool.total_subscription_revenue == Decimal('449.98')
    assert pool.instructor_pool == Decimal('179.99')          # 40 %, to the cent below
    assert pool.is_distributed is True
    (earning,) = f.InstructorEarning.objects.filter(month=month)
    assert earning.final_amount == Decimal('179.99')
    assert earning.is_paid is False                           # figures only: nobody is paid here


def test_the_share_is_a_setting(instructor, students, settings):
    settings.INSTRUCTOR_REVENUE_SHARE_PERCENT = 50
    month = previous_month()
    enrol(students[0], plus_course(instructor), month)
    pay(students[0], month, '100.00')

    run('--month', month_label(month))

    assert f.CourseraRevenuePool.objects.get(month=month).instructor_pool == Decimal('50.00')


def test_the_payouts_add_up_to_the_pool_whatever_the_multipliers(instructor, other_instructor, students):
    """The old calculator multiplied absolute amounts by 0.5 - 2.0, so the total drifted from the pool."""
    month = previous_month()
    popular = plus_course(instructor, 'Popular')
    quiet = plus_course(other_instructor, 'Quiet')
    third = plus_course(instructor, 'Third')
    for index, student in enumerate(students):
        enrol(student, popular, month, status='completed' if index < 5 else 'active')
    enrol(students[0], quiet, month)
    enrol(students[1], third, month)
    enrol(students[2], third, month)
    pay(students[0], month, '33.33')
    pay(students[1], month, '77.77')
    pay(students[2], month, '12.34')

    run('--month', month_label(month))

    pool = f.CourseraRevenuePool.objects.get(month=month).instructor_pool
    amounts = f.InstructorEarning.objects.filter(month=month)
    assert amounts.count() == 3
    assert sum(row.final_amount for row in amounts) == pool        # to the cent
    multipliers = {row.course.title: row.performance_multiplier for row in amounts}
    assert multipliers['Popular'] > multipliers['Quiet']           # completion pays
    by_title = {row.course.title: row.final_amount for row in amounts}
    assert by_title['Popular'] > by_title['Third'] > 0


def test_only_the_cohort_of_the_month_on_plus_courses_counts(instructor, students):
    month = previous_month()
    plus = plus_course(instructor, 'Plus')
    free = f.make_course(instructor, status='published', title='Free')
    enrol(students[0], plus, month)
    enrol(students[1], plus, month)
    enrol(students[2], plus, previous_month(month))      # enrolled the month before
    enrol(students[3], free, month)                      # free courses earn nothing
    pay(students[0], month, '100.00')

    run('--month', month_label(month))

    (earning,) = f.InstructorEarning.objects.filter(month=month)
    assert earning.course == plus
    assert earning.enrollments_count == 2


def test_a_month_without_revenue_records_an_empty_pool_and_no_earnings(instructor, students):
    month = previous_month()
    enrol(students[0], plus_course(instructor), month)

    run('--month', month_label(month))

    pool = f.CourseraRevenuePool.objects.get(month=month)
    assert pool.instructor_pool == 0 and pool.is_distributed is True
    assert f.InstructorEarning.objects.count() == 0


# --------------------------------------------------------------------------- #
# once, after the month, then frozen
# --------------------------------------------------------------------------- #
def test_a_month_that_has_not_ended_is_refused(instructor, students):
    this_month = timezone.now().date().replace(day=1)

    with pytest.raises(CommandError, match='has not ended yet'):
        run('--month', month_label(this_month))

    assert f.CourseraRevenuePool.objects.count() == 0


def test_a_calculated_month_is_frozen(instructor, students):
    month = previous_month()
    course = plus_course(instructor)
    enrol(students[0], course, month)
    pay(students[0], month, '100.00')
    run('--month', month_label(month))
    before = list(f.InstructorEarning.objects.values_list('final_amount', 'enrollments_count'))

    # more happens afterwards: a late payment, another enrollment of the month
    pay(students[1], month, '500.00', day=20)
    enrol(students[1], course, month, day=21)
    with pytest.raises(CommandError, match='calculated already'):
        run('--month', month_label(month))

    assert list(f.InstructorEarning.objects.values_list('final_amount', 'enrollments_count')) == before
    assert f.CourseraRevenuePool.objects.get(month=month).instructor_pool == Decimal('40.00')
    # looking at it shows what was recorded, not a recalculation
    assert 'already frozen' in run('--month', month_label(month), '--dry-run')


def test_a_dry_run_writes_nothing(instructor, students):
    month = previous_month()
    enrol(students[0], plus_course(instructor, 'Shown title'), month)
    pay(students[0], month, '100.00')

    output = run('--month', month_label(month), '--dry-run')

    assert 'dry run' in output and 'Shown title' in output and '40.00' in output
    assert f.CourseraRevenuePool.objects.count() == 0
    assert f.InstructorEarning.objects.count() == 0


def test_the_default_month_is_the_last_one(instructor, students):
    month = previous_month()
    enrol(students[0], plus_course(instructor), month)
    pay(students[0], month, '100.00')

    run()

    assert f.CourseraRevenuePool.objects.get().month == month


@pytest.mark.parametrize('value', ['2026', 'last-month', '2026-13'])
def test_a_bad_month_is_a_clear_error(value):
    with pytest.raises(CommandError, match='YYYY-MM|2026-09'):
        run('--month', value)


# --------------------------------------------------------------------------- #
# what the instructor sees
# --------------------------------------------------------------------------- #
def test_the_dashboard_lists_real_earning_rows_and_the_real_fee(auth_client, instructor, students):
    month = previous_month()
    course = plus_course(instructor, 'Shown')
    enrol(students[0], course, month)
    pay(students[0], month, '100.00')
    run('--month', month_label(month))

    body = auth_client(instructor).get(EARNINGS).json()

    (row,) = body['recent_transactions']
    assert row['course'] == 'Shown'
    assert row['student_email'] is None                  # a share of the pool, not one student's payment
    assert row['amount'] == pytest.approx(40.0)
    assert row['status'] == 'Pending'
    assert body['summary']['platform_fee_rate'] == 60   # the platform keeps what the instructors do not
    chart = {entry['month']: entry['earnings'] for entry in body['monthly_chart']}
    assert chart[month.strftime('%b')] == pytest.approx(40.0)


def test_the_monthly_chart_has_the_last_six_calendar_months(auth_client, instructor):
    body = auth_client(instructor).get(EARNINGS).json()

    today = timezone.now().date()
    expected = []
    for back in range(5, -1, -1):
        index = today.year * 12 + today.month - 1 - back
        expected.append(date(index // 12, index % 12 + 1, 1).strftime('%b'))
    assert [entry['month'] for entry in body['monthly_chart']] == expected
    assert len(set(expected)) == 6
