"""Unexpected failures are logged, never echoed to the client.

Several endpoints catch ``Exception`` so the client gets a JSON error instead of
an HTML 500.  The text of an exception can carry SQL, file paths or the request
details of Stripe (even a piece of the API key), and the frontend shows an
``error`` string as it is, so the response names what failed in general terms
and the cause goes to the server log (CodeQL ``py/stack-trace-exposure``).

Making a read endpoint fail needs a patch one level inside the application;
Stripe is patched at library level, like in ``test_billing.py``.
"""
from unittest.mock import patch

import pytest
import stripe
from rest_framework_simplejwt.tokens import RefreshToken

import factories as f

pytestmark = pytest.mark.django_db

SECRET = 'SECRET-DETAIL(/srv/coursera/db.sqlite3, sk_test_0123456789)'
PROVIDER_ERROR = 'The payment provider could not process this request. Please try again later.'

LOGOUT = '/api/auth/logout/'
STRIPE_SESSION = '/api/billing/checkout/session/'
VERIFY_SESSION = '/api/billing/checkout/verify/'
WEBHOOK = '/api/payments/stripe/webhook/'

StripeError = getattr(stripe, 'StripeError', None) or stripe.error.StripeError


def assert_failure_is_not_echoed(response, caplog, *, status, error):
    """The client gets the fixed message; the cause is still on the server."""
    assert response.status_code == status
    assert response.json() == {'error': error}
    assert SECRET not in response.content.decode()
    assert SECRET in caplog.text


# --------------------------------------------------------------------------- #
# read endpoints
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('method, url, target, error', [
    ('get', '/api/notifications/', 'apps.notifications.services.get_user_notifications',
     'Failed to get notifications'),
    ('get', '/api/notifications/count/', 'apps.notifications.services.get_unread_count',
     'Failed to get notification count'),
    ('post', '/api/notifications/1/read/', 'apps.notifications.services.mark_as_read',
     'Failed to mark notification as read'),
])
def test_a_failing_notification_endpoint_does_not_echo_the_cause(
        auth_client, student, caplog, method, url, target, error):
    with patch(target, side_effect=RuntimeError(SECRET)):
        r = getattr(auth_client(student), method)(url)

    assert_failure_is_not_echoed(r, caplog, status=500, error=error)


def test_a_failing_student_roster_does_not_echo_the_cause(auth_client, instructor, caplog):
    with patch('apps.learning.selectors.instructor_roster', side_effect=RuntimeError(SECRET)):
        r = auth_client(instructor).get('/api/learning/instructor/students/')

    assert_failure_is_not_echoed(r, caplog, status=500, error='Failed to fetch students')


@pytest.mark.parametrize('url, error', [
    ('/api/courses/admin/pending/', 'Failed to fetch pending courses'),
    ('/api/courses/admin/all/', 'Failed to fetch all courses'),
])
def test_a_failing_admin_course_list_does_not_echo_the_cause(
        auth_client, admin, instructor, caplog, url, error):
    f.build_course(instructor, status='pending_review')

    with patch('apps.courses.extensions.total_grade_weight', side_effect=RuntimeError(SECRET)):
        r = auth_client(admin).get(url)

    assert_failure_is_not_echoed(r, caplog, status=500, error=error)


# --------------------------------------------------------------------------- #
# curriculum
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('kind', ['sections', 'lectures'])
def test_a_failing_reorder_does_not_echo_the_cause(auth_client, instructor, caplog, kind):
    course = f.make_course(instructor)
    section = f.make_section(course)
    url = {
        'sections': f'/api/courses/instructor/courses/{course.uuid}/sections/reorder/',
        'lectures': f'/api/courses/instructor/sections/{section.uuid}/lectures/reorder/',
    }[kind]

    with patch('apps.courses.services.curriculum.reorder', side_effect=RuntimeError(SECRET)):
        r = auth_client(instructor).post(url, {f'{kind[:-1]}_orders': []}, format='json')

    assert_failure_is_not_echoed(r, caplog, status=400, error=f'Failed to reorder {kind}')


# --------------------------------------------------------------------------- #
# identity
# --------------------------------------------------------------------------- #
def test_logout_with_a_bad_token_names_no_library_text(auth_client, student):
    r = auth_client(student).post(LOGOUT, {'refresh': 'garbage'}, format='json')

    assert r.status_code == 400
    assert r.json() == {'error': 'Invalid or expired refresh token'}


def test_a_server_fault_while_logging_out_is_a_500_and_not_a_bad_token(auth_client, student):
    refresh = str(RefreshToken.for_user(student))

    with patch.object(RefreshToken, 'blacklist', side_effect=RuntimeError(SECRET)):
        r = auth_client(student, raise_exceptions=False).post(
            LOGOUT, {'refresh': refresh}, format='json')

    assert r.status_code == 500
    assert SECRET not in r.content.decode()


# --------------------------------------------------------------------------- #
# Stripe
# --------------------------------------------------------------------------- #
def test_stripe_failures_do_not_echo_the_cause(api, auth_client, student, caplog):
    client = auth_client(student)

    with patch('stripe.checkout.Session.create', side_effect=StripeError(SECRET)):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=400, error=PROVIDER_ERROR)

    with patch('stripe.checkout.Session.create', side_effect=RuntimeError(SECRET)):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=500, error='Failed to create checkout session')

    with patch('stripe.checkout.Session.retrieve', side_effect=StripeError(SECRET)):
        r = client.post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=400, error=PROVIDER_ERROR)

    with patch('stripe.checkout.Session.retrieve', side_effect=RuntimeError(SECRET)):
        r = client.post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=500, error='Failed to verify the checkout session')

    with patch('stripe.Webhook.construct_event', side_effect=RuntimeError(SECRET)):
        r = api.post(WEBHOOK, data='{}', content_type='application/json',
                     HTTP_STRIPE_SIGNATURE='t=1,v1=signature')
    assert_failure_is_not_echoed(r, caplog, status=500, error='Webhook processing failed')
