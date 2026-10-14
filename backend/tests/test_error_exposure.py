"""Unexpected failures are logged, never echoed to the client.

The text of an exception can carry SQL, file paths or the request details of Stripe
(even a piece of the API key), and the frontend shows an ``error`` string as it is.  So
an unexpected failure anywhere in a view is answered by the exception handler with one
fixed body, ``{"error": ..., "code": "server_error"}`` and status 500, and the cause goes
to the server log (CodeQL ``py/stack-trace-exposure``).  Views do not catch ``Exception``
to get there.  The exception to that rule is the Stripe webhook, which still answers with
its own text until its handlers become retryable.

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
SERVER_ERROR = {
    'error': 'Something went wrong on our side. Please try again later.',
    'code': 'server_error',
}

LOGOUT = '/api/v1/auth/logout/'
STRIPE_SESSION = '/api/v1/billing/checkout/session/'
VERIFY_SESSION = '/api/v1/billing/checkout/verify/'
WEBHOOK = '/api/payments/stripe/webhook/'

StripeError = getattr(stripe, 'StripeError', None) or stripe.error.StripeError


def assert_failure_is_not_echoed(response, caplog, *, status=500, body=None):
    """The client gets the fixed answer; the cause is still on the server."""
    assert response.status_code == status
    assert response.json() == (SERVER_ERROR if body is None else body)
    assert SECRET not in response.content.decode()
    assert SECRET in caplog.text


# --------------------------------------------------------------------------- #
# read endpoints
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('method, url, target', [
    ('get', '/api/v1/notifications/', 'apps.notifications.services.get_user_notifications'),
    ('get', '/api/v1/notifications/count/', 'apps.notifications.services.get_unread_count'),
    ('post', '/api/v1/notifications/1/read/', 'apps.notifications.services.mark_as_read'),
])
def test_a_failing_notification_endpoint_does_not_echo_the_cause(
        auth_client, student, caplog, method, url, target):
    with patch(target, side_effect=RuntimeError(SECRET)):
        r = getattr(auth_client(student), method)(url)

    assert_failure_is_not_echoed(r, caplog)


def test_a_failing_student_roster_does_not_echo_the_cause(auth_client, instructor, caplog):
    with patch('apps.learning.selectors.instructor_roster', side_effect=RuntimeError(SECRET)):
        r = auth_client(instructor).get('/api/v1/learning/instructor/students/')

    assert_failure_is_not_echoed(r, caplog)


@pytest.mark.parametrize('url', [
    '/api/v1/courses/admin/pending/',
    '/api/v1/courses/admin/all/',
])
def test_a_failing_admin_course_list_does_not_echo_the_cause(
        auth_client, admin, instructor, caplog, url):
    f.build_course(instructor, status='pending_review')

    with patch('apps.courses.extensions.total_grade_weight', side_effect=RuntimeError(SECRET)):
        r = auth_client(admin).get(url)

    assert_failure_is_not_echoed(r, caplog)


def test_a_failing_instructor_course_list_is_an_error_and_not_an_empty_list(
        auth_client, instructor, caplog):
    """It used to answer ``[]`` with a 200, which the dashboard showed as 'no courses yet'."""
    f.make_course(instructor)

    with patch('apps.courses.extensions.enrich_course_row', side_effect=RuntimeError(SECRET)):
        r = auth_client(instructor).get('/api/v1/courses/instructor/courses/')

    assert_failure_is_not_echoed(r, caplog)


# --------------------------------------------------------------------------- #
# curriculum
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('kind', ['sections', 'lectures'])
def test_a_failing_reorder_does_not_echo_the_cause(auth_client, instructor, caplog, kind):
    course = f.make_course(instructor)
    section = f.make_section(course)
    url = {
        'sections': f'/api/v1/courses/instructor/courses/{course.uuid}/sections/reorder/',
        'lectures': f'/api/v1/courses/instructor/sections/{section.uuid}/lectures/reorder/',
    }[kind]

    with patch('apps.courses.services.curriculum.reorder', side_effect=RuntimeError(SECRET)):
        r = auth_client(instructor).post(url, {f'{kind[:-1]}_orders': []}, format='json')

    assert_failure_is_not_echoed(r, caplog)


# --------------------------------------------------------------------------- #
# identity
# --------------------------------------------------------------------------- #
def test_logout_with_a_bad_token_names_no_library_text(auth_client, student):
    r = auth_client(student).post(LOGOUT, {'refresh': 'garbage'}, format='json')

    assert r.status_code == 400
    assert r.json() == {'error': 'Invalid or expired refresh token'}


def test_a_server_fault_while_logging_out_is_a_500_and_not_a_bad_token(
        auth_client, student, caplog):
    refresh = str(RefreshToken.for_user(student))

    with patch.object(RefreshToken, 'blacklist', side_effect=RuntimeError(SECRET)):
        r = auth_client(student, raise_exceptions=False).post(
            LOGOUT, {'refresh': refresh}, format='json')

    assert_failure_is_not_echoed(r, caplog)


# --------------------------------------------------------------------------- #
# Stripe
# --------------------------------------------------------------------------- #
def test_stripe_failures_do_not_echo_the_cause(api, auth_client, student, caplog):
    client = auth_client(student)

    # Stripe refusing a request is an expected failure with its own fixed message ...
    with patch('stripe.checkout.Session.create', side_effect=StripeError(SECRET)):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=400, body={'error': PROVIDER_ERROR})

    # ... anything else is a bug and gets the generic answer
    with patch('stripe.checkout.Session.create', side_effect=RuntimeError(SECRET)):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert_failure_is_not_echoed(r, caplog)

    with patch('stripe.checkout.Session.retrieve', side_effect=StripeError(SECRET)):
        r = client.post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')
    assert_failure_is_not_echoed(r, caplog, status=400, body={'error': PROVIDER_ERROR})

    with patch('stripe.checkout.Session.retrieve', side_effect=RuntimeError(SECRET)):
        r = client.post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')
    assert_failure_is_not_echoed(r, caplog)

    with patch('stripe.Webhook.construct_event', side_effect=RuntimeError(SECRET)):
        r = api.post(WEBHOOK, data='{}', content_type='application/json',
                     HTTP_STRIPE_SIGNATURE='t=1,v1=signature')
    assert_failure_is_not_echoed(r, caplog, body={'error': 'Webhook processing failed'})
