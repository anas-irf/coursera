"""Throttling: named scopes, rates from the settings, counters in the cache.

The suite settings make every scope practically unlimited (thousands of calls
come from one address); each test here sets the rate it is about.
"""
import pytest
from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle

import factories as f

pytestmark = pytest.mark.django_db

LOGIN = '/api/v1/auth/login/'
SIGNUP = '/api/v1/auth/signup/'
REFRESH = '/api/v1/auth/token/refresh/'
SEND = '/api/v1/messaging/send/'


@pytest.fixture(autouse=True)
def fresh_counters():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def rates(monkeypatch):
    """``rates(login='2/min')`` turns real, low rates on for the scopes named."""
    def apply(**scopes):
        monkeypatch.setattr(SimpleRateThrottle, 'THROTTLE_RATES',
                            {**SimpleRateThrottle.THROTTLE_RATES, **scopes})
    return apply


def bad_login(api, student):
    return api.post(LOGIN, {'email': student.email, 'password': 'not-the-password'}, format='json')


def test_guessing_a_password_is_throttled_after_the_allowed_attempts(api, student, rates):
    rates(login='3/min')

    assert [bad_login(api, student).status_code for _ in range(3)] == [401, 401, 401]
    blocked = bad_login(api, student)

    assert blocked.status_code == 429
    assert int(blocked['Retry-After']) > 0


def test_scopes_do_not_share_a_bucket(api, student, rates):
    rates(login='1/min', signup='100/min')
    bad_login(api, student)
    assert bad_login(api, student).status_code == 429

    r = api.post(SIGNUP, {'email': 'someone@example.com', 'password': f.DEFAULT_PASSWORD,
                          'confirm_password': f.DEFAULT_PASSWORD, 'first_name': 'Some',
                          'last_name': 'One', 'user_type': 'student'}, format='json')

    assert r.status_code != 429


def test_the_unversioned_alias_and_the_versioned_path_are_one_bucket(api, student, rates):
    rates(login='2/min')

    assert bad_login(api, student).status_code == 401
    r = api.post('/api/auth/login/', {'email': student.email, 'password': 'x'}, format='json')
    assert r.status_code == 401
    assert bad_login(api, student).status_code == 429


def test_token_refresh_is_throttled(api, rates):
    rates(refresh='2/min')

    codes = [api.post(REFRESH, {'refresh': 'not-a-token'}, format='json').status_code for _ in range(3)]

    assert codes[:2] == [401, 401]
    assert codes[2] == 429


def test_sending_messages_is_limited_per_user(auth_client, student, admin, other_student, rates):
    rates(messages='2/min')
    payload = {'recipient_id': admin.id, 'content': 'hi'}   # everybody may write to an admin

    assert [auth_client(student).post(SEND, payload, format='json').status_code for _ in range(2)] == [201, 201]
    assert auth_client(student).post(SEND, payload, format='json').status_code == 429
    # another user has a bucket of their own
    assert auth_client(other_student).post(SEND, payload, format='json').status_code == 201


def test_the_recorded_login_address_follows_the_number_of_proxies(api, student, settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1}
    forwarded = '203.0.113.7, 198.51.100.9'  # the client, then the one proxy we trust

    r = api.post(LOGIN, {'email': student.email, 'password': f.DEFAULT_PASSWORD}, format='json',
                 HTTP_X_FORWARDED_FOR=forwarded, REMOTE_ADDR='10.0.0.1')

    assert r.status_code == 200
    student.refresh_from_db()
    assert student.last_login_ip == '198.51.100.9'


def test_without_proxies_the_forwarded_header_is_ignored(api, student, settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'NUM_PROXIES': 0}

    r = api.post(LOGIN, {'email': student.email, 'password': f.DEFAULT_PASSWORD}, format='json',
                 HTTP_X_FORWARDED_FOR='203.0.113.7', REMOTE_ADDR='10.0.0.1')

    assert r.status_code == 200
    student.refresh_from_db()
    assert student.last_login_ip == '10.0.0.1'
