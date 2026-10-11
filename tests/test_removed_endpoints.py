"""Demo / debug / duplicate endpoints that the refactor plans to delete.

*** READ ME ***  Every test in this module documents the CURRENT behaviour of an
endpoint that refactor step S1a ("purge") removes or whose behaviour it changes
(see "Removed" in the plan).  After S1a these tests are EXPECTED to be deleted
(or flipped to assert a 404).  They exist only so that, until then, the purge
can be verified to remove exactly this list and nothing else.  No other module
of the suite depends on any of these endpoints.
"""
import uuid
from decimal import Decimal

import pytest

import factories as f

pytestmark = [pytest.mark.django_db, pytest.mark.removed_in_s1a]

CREATE_SUBSCRIPTION = '/api/auth/student/create-subscription/'
DEBUG_SUBSCRIPTION = '/api/auth/student/debug-subscription/'
CHECKOUT_PROCESS = '/api/payments/checkout/process/'
CHECKOUT_VALIDATE = '/api/payments/checkout/validate/'
MANUAL_SUBSCRIPTION = '/api/payments/debug/manual-subscription/'
TEST_WEBHOOK = '/api/payments/debug/test-webhook/'
TEST_RECURRING = '/api/payments/debug/test-recurring/'
TEST_NOTIFICATION = '/api/courses/notifications/test/'

CARD = {'card_number': '4242 4242 4242 4242', 'expiry_month': '12', 'expiry_year': '2099',
        'cvv': '123', 'cardholder_name': 'Test Student'}


# --------------------------------------------------------------------------- #
# accounts: demo subscription helpers
# --------------------------------------------------------------------------- #
def test_create_subscription_demo_endpoint(auth_client, student, instructor):
    """POST create-subscription creates an active demo subscription and payment."""
    client = auth_client(student)

    r = client.post(CREATE_SUBSCRIPTION, {'subscription_type': 'yearly'}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'message', 'subscription'}
    assert body['subscription']['status'] == 'active'
    assert body['subscription']['subscription_type'] == 'yearly'
    sub = f.get_subscription(student)
    assert sub.status == 'active' and sub.is_active() is True
    payment = f.StudentPlusPayment.objects.get(subscription=sub)
    assert payment.status == 'completed'
    assert payment.transaction_id.startswith('demo_txn_')

    r = client.post(CREATE_SUBSCRIPTION, {}, format='json')
    assert r.status_code == 400  # already has a subscription
    assert auth_client(instructor).post(CREATE_SUBSCRIPTION, {}, format='json').status_code == 403


def test_debug_subscription_endpoint(auth_client, student, instructor):
    """GET debug-subscription dumps the subscription state (instructors get an error payload with 200)."""
    f.give_plus(student)

    r = auth_client(student).get(DEBUG_SUBSCRIPTION)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'user_id', 'user_email', 'subscription_exists_in_db',
                         'subscription_count', 'subscription_data',
                         'has_plus_access_property', 'all_subscriptions_count'}
    assert body['subscription_exists_in_db'] is True
    assert body['has_plus_access_property'] is True

    r = auth_client(instructor).get(DEBUG_SUBSCRIPTION)
    assert r.status_code == 200  # (sic) an error payload with status 200
    assert r.json() == {'error': 'Only for students'}


# --------------------------------------------------------------------------- #
# payments: simulated card checkout and debug helpers
# --------------------------------------------------------------------------- #
def test_checkout_process_simulated_card_payment(auth_client, student, instructor):
    """checkout/process simulates a card payment; non-UUID plan ids crash."""
    client = auth_client(student)
    lenient = auth_client(student, raise_exceptions=False)
    plan = f.SubscriptionPlan.objects.create(name='Monthly', description='demo plan',
                                             price=Decimal('49.99'), billing_cycle='monthly')

    assert client.post(CHECKOUT_PROCESS, {}, format='json').status_code == 400
    incomplete = {'plan_id': str(plan.uuid), 'payment_method': 'card',
                  'payment_details': {'card_number': '4242424242424242'}}
    assert client.post(CHECKOUT_PROCESS, incomplete, format='json').status_code == 400

    # plan ids are looked up as UUIDs: a well-formed but unknown id is a clean 400 ...
    unknown = {'plan_id': str(uuid.uuid4()), 'payment_method': 'card', 'payment_details': CARD}
    assert client.post(CHECKOUT_PROCESS, unknown, format='json').status_code == 400
    # ... while anything else (including the built-in "monthly"/"yearly" ids that the
    # checkout page advertises) crashes the lookup: current behaviour (bug), a 500.
    for plan_id in ('platinum', 'monthly', 'yearly'):
        crash = {'plan_id': plan_id, 'payment_method': 'card', 'payment_details': CARD}
        assert lenient.post(CHECKOUT_PROCESS, crash, format='json').status_code == 500, plan_id

    declined = {'plan_id': str(plan.uuid), 'payment_method': 'card',
                'payment_details': {**CARD, 'card_number': '4000 0000 0000 0000'}}
    r = client.post(CHECKOUT_PROCESS, declined, format='json')
    assert r.status_code == 400 and 'declined' in r.json()['error']
    assert f.get_subscription(student) is None

    ok = {'plan_id': str(plan.uuid), 'payment_method': 'card', 'payment_details': CARD}
    r = client.post(CHECKOUT_PROCESS, ok, format='json')
    assert r.status_code == 201
    body = r.json()
    assert body['success'] is True
    assert set(body) == {'success', 'message', 'subscription', 'payment'}
    sub = f.get_subscription(student)
    assert sub.status == 'active' and sub.subscription_type == 'monthly'
    assert float(f.StudentPlusPayment.objects.get(subscription=sub).amount) == pytest.approx(49.99)

    assert client.post(CHECKOUT_PROCESS, ok, format='json').status_code == 400  # already active
    assert auth_client(instructor).post(CHECKOUT_PROCESS, ok, format='json').status_code == 403


def test_checkout_validate_endpoint(auth_client, student, instructor):
    """checkout/validate returns {valid, errors} for card details."""
    client = auth_client(student)

    r = client.post(CHECKOUT_VALIDATE, {'payment_method': 'card', 'payment_details': CARD},
                    format='json')
    assert r.status_code == 200
    assert r.json() == {'valid': True, 'errors': {}}

    r = client.post(CHECKOUT_VALIDATE, {'payment_method': 'card', 'payment_details': {
        'card_number': '12', 'expiry_month': '13', 'expiry_year': '2099', 'cvv': '1',
        'cardholder_name': ''}}, format='json')
    assert r.status_code == 200
    body = r.json()
    assert body['valid'] is False
    assert {'card_number', 'expiry', 'cvv', 'cardholder_name'} <= set(body['errors'])

    assert auth_client(instructor).post(CHECKOUT_VALIDATE, {}, format='json').status_code == 403


def test_manual_subscription_debug_endpoint(auth_client, student, instructor):
    """debug/manual-subscription creates (or reports) a subscription."""
    client = auth_client(student)

    r = client.post(MANUAL_SUBSCRIPTION, {'plan_id': 'yearly'}, format='json')

    assert r.status_code == 200
    assert r.json()['subscription']['type'] == 'yearly'
    sub = f.get_subscription(student)
    assert sub.status == 'active' and sub.payment_method == 'test'

    again = client.post(MANUAL_SUBSCRIPTION, {}, format='json')
    assert again.status_code == 200
    assert again.json()['message'] == 'Subscription already exists'

    assert auth_client(instructor).post(MANUAL_SUBSCRIPTION, {}, format='json').status_code == 400


def test_test_webhook_debug_endpoint_runs_the_real_handler(auth_client, student, instructor):
    """debug/test-webhook feeds a fake session to the real webhook handler."""
    client = auth_client(student)

    r = client.post(TEST_WEBHOOK, {'plan_id': 'monthly'}, format='json')

    assert r.status_code == 200
    assert 'message' in r.json()
    sub = f.get_subscription(student)
    assert sub.status == 'active' and sub.payment_method == 'stripe'
    payment = f.StudentPlusPayment.objects.get(subscription=sub)
    assert payment.transaction_id == 'pi_test_123'

    assert client.post(TEST_WEBHOOK, {}, format='json').status_code == 200  # no duplicate
    assert f.StudentPlusPayment.objects.filter(subscription=sub).count() == 1
    assert auth_client(instructor).post(TEST_WEBHOOK, {}, format='json').status_code == 400


def test_test_recurring_debug_endpoint(auth_client, student, instructor):
    """debug/test-recurring simulates renewal / failure events."""
    client = auth_client(student)

    # needs an existing subscription
    assert client.post(TEST_RECURRING, {'webhook_type': 'renewal'}, format='json').status_code == 404

    sub = f.give_plus(student)
    r = client.post(TEST_RECURRING, {'webhook_type': 'renewal'}, format='json')
    assert r.status_code == 200
    assert r.json()['type'] == 'renewal'
    assert f.StudentPlusPayment.objects.filter(subscription=sub, status='completed').count() == 1

    r = client.post(TEST_RECURRING, {'webhook_type': 'failed', 'attempt_count': 3}, format='json')
    assert r.status_code == 200
    assert r.json()['subscription_status'] == 'suspended'
    sub.refresh_from_db()
    assert sub.status == 'suspended'

    # an unknown webhook_type falls through the view without a response -> 500
    r = auth_client(student, raise_exceptions=False).post(
        TEST_RECURRING, {'webhook_type': 'other'}, format='json')
    assert r.status_code == 500

    assert auth_client(instructor).post(TEST_RECURRING, {}, format='json').status_code == 400


# --------------------------------------------------------------------------- #
# courses: test notification, instructor actions, duplicate routes
# --------------------------------------------------------------------------- #
def test_create_test_notification_endpoint(auth_client, student):
    """courses/notifications/test creates a system notification."""
    r = auth_client(student).post(TEST_NOTIFICATION)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'message', 'notification_id', 'title'}
    note = f.Notification.objects.get(pk=body['notification_id'])
    assert note.recipient_id == student.id
    assert note.notification_type == 'system'


def test_instructor_publish_action_is_unreachable_for_everybody(auth_client, instructor, admin):
    """``publish`` demands ``is_admin`` but sits behind ``IsInstructor``: instructors
    are refused by the action itself, admins by the permission class."""
    course = f.build_course(instructor, status='draft').course
    url = f'/api/courses/instructor/courses/{course.uuid}/publish/'

    r = auth_client(instructor).post(url)
    assert r.status_code == 403
    assert 'error' in r.json()
    assert auth_client(admin).post(url).status_code == 403

    course.refresh_from_db()
    assert course.status == 'draft'


def test_instructor_course_test_endpoint(auth_client, instructor):
    """The instructor ``test_endpoint`` action echoes course and user."""
    course = f.make_course(instructor)

    r = auth_client(instructor).get(f'/api/courses/instructor/courses/{course.uuid}/test_endpoint/')

    assert r.status_code == 200
    assert set(r.json()) == {'message', 'course_id', 'user'}
    assert r.json()['course_id'] == str(course.uuid)


def test_duplicate_instructor_students_route_matches_the_router_action(auth_client, instructor, student):
    """/instructor/students/ duplicates /instructor/courses/students/."""
    course = f.make_course(instructor, status='published')
    f.enroll(student, course)
    client = auth_client(instructor)

    legacy = client.get('/api/courses/instructor/students/')
    current = client.get('/api/courses/instructor/courses/students/')

    assert legacy.status_code == 200
    assert legacy.json() == current.json()
    assert [row['email'] for row in legacy.json()] == [student.email]


@pytest.mark.filterwarnings('ignore:DateTimeField .* received a naive datetime')
def test_duplicate_courses_student_stats_route(auth_client, instructor, student):
    """/api/courses/student/stats/ duplicates the /api/auth/ stats."""
    f.enroll(student, f.make_course(instructor, status='published'))

    r = auth_client(student).get('/api/courses/student/stats/')

    assert r.status_code == 200
    assert set(r.json()) == {'total_courses', 'completed_courses', 'certificates_earned',
                             'total_learning_hours', 'current_streak', 'longest_streak',
                             'this_week_hours', 'achievements'}
    assert r.json()['total_courses'] == 1
    assert auth_client(instructor).get('/api/courses/student/stats/').status_code == 403


def test_duplicate_courses_weekly_progress_route(auth_client, student, instructor):
    """/api/courses/student/weekly-progress/ returns a 7 day series."""
    r = auth_client(student).get('/api/courses/student/weekly-progress/')

    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 7
    assert all(set(row) == {'day', 'hours'} for row in rows)
    assert auth_client(instructor).get('/api/courses/student/weekly-progress/').status_code == 403


def test_inherited_model_viewset_delete_bypasses_the_delete_course_guard(auth_client, instructor, student):
    """Current behaviour (bug): ``DELETE /instructor/courses/<id>/`` comes with the
    ModelViewSet and removes the course - and its enrolments - without the
    confirmation string or the "has enrolled students" check of ``delete-course``."""
    course = f.make_course(instructor, status='published')
    f.enroll(student, course)

    r = auth_client(instructor).delete(f'/api/courses/instructor/courses/{course.uuid}/')

    assert r.status_code == 204
    assert not f.Course.objects.filter(pk=course.pk).exists()
    assert f.Enrollment.objects.filter(student=student).count() == 0


def test_course_analytics_action_still_exposes_review_fields(auth_client, instructor):
    """Refactor step S1a drops ``recent_reviews`` / ratings from this payload."""
    course = f.make_course(instructor, status='published')

    body = auth_client(instructor).get(
        f'/api/courses/instructor/courses/{course.uuid}/analytics/').json()

    assert {'average_rating', 'total_reviews', 'recent_reviews'} <= set(body)
    assert body['recent_reviews'] == []
