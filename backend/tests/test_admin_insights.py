"""The administrator's revenue page, reports and platform overview."""
import csv
import io
from datetime import datetime, time
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

REVENUE = '/api/v1/insights/admin/revenue/'
REPORTS = '/api/v1/insights/admin/reports/'
PLATFORM = '/api/v1/insights/admin/platform/'


def month_start(back=0):
    """The first day of the month ``back`` months ago."""
    today = timezone.localdate()
    index = today.year * 12 + today.month - 1 - back
    return today.replace(year=index // 12, month=index % 12 + 1, day=1)


def pay(subscription, amount, *, when, status='completed'):
    payment = f.StudentPlusPayment.objects.create(subscription=subscription, amount=Decimal(amount),
                                                  status=status, payment_method='stripe')
    f.StudentPlusPayment.objects.filter(pk=payment.pk).update(payment_date=when)
    return payment


def at_noon(day):
    return timezone.make_aware(datetime.combine(day, time(12)))


@pytest.fixture
def money_world(instructor):
    """Three members (monthly, yearly, cancelled), one lapsed, a ledger month and a live month."""
    now = timezone.now()
    monthly, yearly, cancelling, lapsed = (f.make_student(first_name=name) for name in ('Mo', 'Yara', 'Cal', 'Lee'))
    m = f.give_plus(monthly, plan='monthly')
    y = f.give_plus(yearly, plan='yearly', days=300)
    c = f.give_plus(cancelling, plan='monthly', status='cancelled', days=10)
    gone = f.give_plus(lapsed, plan='monthly', status='expired', days=-5)
    f.StudentPlusSubscription.objects.filter(pk=c.pk).update(auto_renew=False)

    this_month = at_noon(month_start())
    last_month = at_noon(month_start(1))
    pay(m, '49.99', when=this_month)
    pay(y, '399.99', when=last_month)
    pay(c, '49.99', when=last_month)
    pay(gone, '49.99', when=this_month, status='failed')

    f.CourseraRevenuePool.objects.create(month=month_start(1), total_subscription_revenue=Decimal('1000.00'),
                                         instructor_pool=Decimal('400.00'), is_distributed=True)
    best = f.make_course(instructor, status='published', course_type='coursera_plus', title='Best seller')
    other = f.make_course(instructor, status='published', course_type='coursera_plus', title='Runner up')
    f.enroll(monthly, best)
    f.make_earning(instructor, best, month=month_start(1), amount=Decimal('300.00'), is_paid=True)
    f.make_earning(instructor, other, month=month_start(1), amount=Decimal('100.00'), is_paid=True)
    f.make_earning(instructor, best, month=month_start(), amount=Decimal('20.00'))
    return {'now': now, 'subscriptions': (m, y, c, gone)}


def test_a_month_with_a_pool_comes_from_the_ledger_and_the_current_one_is_live(auth_client, admin, money_world):
    body = auth_client(admin).get(REVENUE).json()

    assert set(body) == {'currency', 'months', 'revenue_share_percent', 'summary', 'monthly', 'subscriptions',
                         'plans', 'top_courses', 'recent_payments'}
    assert (body['currency'], body['months'], body['revenue_share_percent']) == ('USD', 6, 40)
    current, previous = body['monthly'][-1], body['monthly'][-2]
    assert previous == {
        'month': month_start(1).strftime('%Y-%m'), 'label': month_start(1).strftime('%b'),
        'gross': 1000.0, 'instructor_share': 400.0, 'platform_share': 600.0,
        'payments': 2, 'new_members': 0, 'source': 'ledger'}
    assert current['source'] == 'live'
    assert (current['gross'], current['instructor_share'], current['platform_share']) == (49.99, 20.0, 29.99)
    assert current['payments'] == 1 and current['new_members'] == 4


def test_the_summary_adds_up_the_months_and_counts_the_members(auth_client, admin, money_world):
    summary = auth_client(admin).get(REVENUE).json()['summary']

    assert summary == {
        'gross_revenue': 1049.99, 'instructor_share': 420.0, 'platform_share': 629.99,
        'this_month': 49.99,
        'members': 3, 'renewing_members': 2,
        'mrr': round(49.99 + 399.99 / 12, 2),
        'failed_payments': 1,
        'earnings_paid': 400.0, 'earnings_pending': 20.0,
    }


def test_subscriptions_plans_courses_and_payments(auth_client, admin, money_world):
    body = auth_client(admin).get(REVENUE).json()

    assert body['subscriptions'] == {'active': 2, 'cancelled': 1, 'lapsed': 1, 'monthly': 3, 'yearly': 1}
    assert body['plans'] == [
        {'cycle': 'monthly', 'name': 'Coursera Plus Monthly', 'price': 49.99, 'members': 2},
        {'cycle': 'yearly', 'name': 'Coursera Plus Annual', 'price': 399.99, 'members': 1},
    ]
    assert [(row['title'], row['earnings'], row['enrollments']) for row in body['top_courses']] == [
        ('Best seller', 320.0, 1), ('Runner up', 100.0, 0)]
    assert body['top_courses'][0]['instructor'] == 'Instructor Tester'
    payments = body['recent_payments']
    assert len(payments) == 4
    assert [row['status'] for row in payments[:2]] == ['completed', 'failed'] or \
        [row['status'] for row in payments[:2]] == ['failed', 'completed']
    assert set(payments[0]) == {'id', 'student', 'email', 'plan', 'amount', 'status', 'date'}


def test_a_year_can_be_asked_for_and_nothing_else(auth_client, admin):
    assert len(auth_client(admin).get(REVENUE, {'months': 12}).json()['monthly']) == 12
    assert auth_client(admin).get(REVENUE, {'months': 3}).status_code == 400


def test_an_empty_platform_has_empty_revenue(auth_client, admin):
    body = auth_client(admin).get(REVENUE).json()

    assert body['summary']['gross_revenue'] == 0.0 and body['summary']['members'] == 0
    assert body['summary']['mrr'] == 0.0
    assert body['top_courses'] == [] and body['recent_payments'] == []
    assert all(row['source'] == 'live' and row['gross'] == 0.0 for row in body['monthly'])


# --------------------------------------------------------------------------- #
# reports
# --------------------------------------------------------------------------- #
def test_the_reports_are_listed_with_their_row_counts(auth_client, admin, instructor, student):
    f.enroll(student, f.make_course(instructor, status='published'))

    rows = auth_client(admin).get(REPORTS).json()

    assert [row['id'] for row in rows] == ['users', 'courses', 'enrollments', 'payments', 'earnings',
                                          'certificates']
    counts = {row['id']: row['rows'] for row in rows}
    assert counts == {'users': 3, 'courses': 1, 'enrollments': 1, 'payments': 0, 'earnings': 0,
                      'certificates': 0}
    assert all(row['name'] and row['description'] for row in rows)


def read_csv(response):
    return list(csv.reader(io.StringIO(response.content.decode('utf-8'))))


def test_a_report_downloads_as_csv(auth_client, admin, instructor, student):
    course = f.make_course(instructor, status='published', title='Statistics')
    enrollment = f.enroll(student, course, status='completed')
    f.make_certificate(enrollment, grade=Decimal('88.00'))
    f.make_earning(instructor, course, amount=Decimal('12.30'))

    r = auth_client(admin).get(f'{REPORTS}users/')

    assert r.status_code == 200
    assert r['Content-Type'] == 'text/csv; charset=utf-8'
    assert r['Content-Disposition'] == f'attachment; filename="users-{timezone.localdate().isoformat()}.csv"'
    table = read_csv(r)
    assert table[0] == ['id', 'name', 'email', 'role', 'status', 'email_verified', 'date_joined', 'last_login',
                        'country', 'city']
    assert {row[2] for row in table[1:]} == {admin.email, instructor.email, student.email}

    for report, title_column in (('courses', 1), ('enrollments', 3), ('earnings', 3), ('certificates', 3)):
        table = read_csv(auth_client(admin).get(f'{REPORTS}{report}/'))
        assert table[1][title_column] == 'Statistics', report


def test_a_payment_report_lists_every_payment(auth_client, admin, student):
    subscription = f.give_plus(student)
    pay(subscription, '49.99', when=timezone.now())

    table = read_csv(auth_client(admin).get(f'{REPORTS}payments/'))

    assert table[1][1:8] == ['Student Tester', student.email, 'monthly', '49.99', 'USD', 'completed',
                             table[1][7]]


def test_a_cell_a_spreadsheet_would_run_is_written_as_text(auth_client, admin):
    f.make_student(first_name='=HYPERLINK("https://evil.example")', last_name='')

    table = read_csv(auth_client(admin).get(f'{REPORTS}users/'))

    names = {row[1] for row in table[1:]}
    assert '\'=HYPERLINK("https://evil.example")' in names


def test_an_unknown_report_is_a_404(auth_client, admin):
    r = auth_client(admin).get(f'{REPORTS}passwords/')

    assert r.status_code == 404 and r.json()['error']


# --------------------------------------------------------------------------- #
# the platform
# --------------------------------------------------------------------------- #
def test_the_platform_page_shows_the_rules_the_vocabulary_and_the_instance(auth_client, admin, instructor,
                                                                          settings):
    settings.DEMO_MODE = True
    category = f.make_category('Data Science')
    f.make_category('Empty')
    english = f.make_language(code='en', name='English')
    f.make_course(instructor, status='published', category=category, language=english)
    f.make_course(instructor, status='draft', category=category)

    body = auth_client(admin).get(PLATFORM).json()

    assert body['rules'] == {'revenue_share_percent': 40, 'course_passing_grade': 60,
                             'quiz_submit_grace_seconds': 30, 'access_token_minutes': 60,
                             'refresh_token_days': 7}
    assert [(row['name'], row['courses'], row['published']) for row in body['categories']] == [
        ('Data Science', 2, 1), ('Empty', 0, 0)]
    assert body['languages'] == [{'id': english.id, 'code': 'en', 'name': 'English', 'courses': 1}]
    assert body['environment'] == {'demo_mode': True, 'debug': False, 'database': 'sqlite' if 'sqlite' in
                                   settings.DATABASES['default']['ENGINE'] else 'postgresql',
                                   'realtime': 'memory', 'stripe': bool(settings.STRIPE_SECRET_KEY),
                                   'api_version': 'v1'}


@pytest.mark.parametrize('url', [REVENUE, REPORTS, f'{REPORTS}users/', PLATFORM])
def test_only_admins_see_the_money_and_the_reports(api, auth_client, student, instructor, url):
    assert api.get(url).status_code == 401
    assert auth_client(student).get(url).status_code == 403
    assert auth_client(instructor).get(url).status_code == 403
