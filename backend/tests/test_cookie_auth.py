"""Session cookies: the browser's JWT pair is in HttpOnly cookies, out of reach of scripts.

A bearer header keeps working for non-browser callers.  A request authenticated by the cookie
that changes data must come from our own front end (X-Requested-With and an allowed Origin),
because the browser attaches the cookie to whatever page makes the request.
"""
import pytest
from asgiref.sync import async_to_sync
from channels.layers import channel_layers
from channels.testing import WebsocketCommunicator
from django.conf import settings as django_settings
from django.utils.module_loading import import_string

import factories as f

pytestmark = pytest.mark.django_db

LOGIN = '/api/v1/auth/login/'
LOGOUT = '/api/v1/auth/logout/'
REFRESH = '/api/v1/auth/token/refresh/'
PROFILE = '/api/v1/auth/profile/'
ORIGIN = 'http://localhost:3000'
OUR_PAGE = {'HTTP_ORIGIN': ORIGIN, 'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'}
ANOTHER_SITE = {'HTTP_ORIGIN': 'https://evil.example', 'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'}


@pytest.fixture(autouse=True)
def _fresh_channel_layer():
    channel_layers.backends.clear()
    yield
    channel_layers.backends.clear()


def sign_in(api, user, **headers):
    r = api.post(LOGIN, {'email': user.email, 'password': f.DEFAULT_PASSWORD}, format='json', **headers)
    assert r.status_code == 200
    return r


def cookie(response, name):
    return response.cookies[name]


# --------------------------------------------------------------------------- #
# login
# --------------------------------------------------------------------------- #
def test_login_sets_both_session_cookies_out_of_reach_of_scripts(api, student):
    r = sign_in(api, student)

    access, refresh = cookie(r, 'coursera_access'), cookie(r, 'coursera_refresh')
    for morsel in (access, refresh):
        assert morsel['httponly'] is True
        assert morsel['samesite'] == 'Lax'
        assert morsel.value
    assert access['path'] == '/'                 # the WebSocket needs it too
    assert refresh['path'] == '/api/'            # only the auth endpoints do
    assert int(access['max-age']) == 60 * 60
    assert int(refresh['max-age']) == 7 * 24 * 3600


def test_the_answer_still_carries_the_tokens_while_the_legacy_transport_is_on(api, student):
    body = sign_in(api, student).json()

    assert set(body) == {'user', 'profile', 'tokens'}
    assert set(body['tokens']) == {'access', 'refresh'}


def test_without_the_legacy_transport_the_tokens_are_only_in_the_cookies(api, student, settings):
    settings.AUTH_LEGACY_TOKEN_TRANSPORT = False

    plain = sign_in(api, student)
    assert set(plain.json()) == {'user', 'profile'}
    assert cookie(plain, 'coursera_access').value

    # a script that wants bearer tokens says so
    bearer = sign_in(api, student, HTTP_X_AUTH_TRANSPORT='bearer')
    assert set(bearer.json()['tokens']) == {'access', 'refresh'}


def test_a_wrong_password_sets_no_cookie(api, student):
    r = api.post(LOGIN, {'email': student.email, 'password': 'wrong'}, format='json')

    assert r.status_code == 401
    assert 'coursera_access' not in r.cookies and 'coursera_refresh' not in r.cookies


def test_a_stale_cookie_does_not_block_signing_in_again(api, student):
    """The login is what replaces the session, so whatever the old cookie says must not matter."""
    api.cookies['coursera_access'] = 'expired.or.broken'
    api.cookies['coursera_refresh'] = 'expired.or.broken'

    r = api.post(LOGIN, {'email': student.email, 'password': f.DEFAULT_PASSWORD}, format='json')

    assert r.status_code == 200
    assert cookie(r, 'coursera_access').value != 'expired.or.broken'


# --------------------------------------------------------------------------- #
# using the cookie
# --------------------------------------------------------------------------- #
def test_the_cookie_authenticates_without_any_header(api, student):
    sign_in(api, student)

    r = api.get(PROFILE)

    assert r.status_code == 200
    assert r.json()['user']['email'] == student.email


def test_a_bearer_header_wins_over_the_cookie_and_needs_no_origin(api, student, other_student):
    sign_in(api, student)                                     # the cookie says: student
    token = f.access_token_for(other_student)

    r = api.get(PROFILE, HTTP_AUTHORIZATION=f'Bearer {token}')

    assert r.json()['user']['email'] == other_student.email


def test_a_cookie_request_that_changes_data_must_come_from_our_front_end(api, student):
    note = f.make_notification(student)
    sign_in(api, student)
    url = f'/api/v1/notifications/{note.id}/read/'

    assert api.post(url).status_code == 403                                   # no header, no origin
    assert api.post(url, HTTP_X_REQUESTED_WITH='XMLHttpRequest').status_code == 403    # no origin
    assert api.post(url, **ANOTHER_SITE).status_code == 403                   # somebody else's page
    assert f.reload(note).is_read is False

    assert api.post(url, **OUR_PAGE).status_code == 200
    assert f.reload(note).is_read is True


def test_reading_with_the_cookie_needs_no_origin_header(api, student):
    sign_in(api, student)

    assert api.get('/api/v1/notifications/').status_code == 200


def test_a_bearer_request_that_changes_data_is_not_bound_to_an_origin(api, student):
    note = f.make_notification(student)
    token = f.access_token_for(student)

    r = api.post(f'/api/v1/notifications/{note.id}/read/', HTTP_AUTHORIZATION=f'Bearer {token}')

    assert r.status_code == 200


def test_a_garbage_cookie_is_a_401(api):
    api.cookies['coursera_access'] = 'not.a.jwt'

    assert api.get(PROFILE).status_code == 401


def test_the_browser_may_send_the_cookie_and_the_header_across_origins(api, student):
    """The front end and the API are different origins: the preflight must allow credentials and
    X-Requested-With, and name the app's origin exactly (a wildcard is refused with credentials)."""
    r = api.options(
        PROFILE, HTTP_ORIGIN=ORIGIN, HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,x-requested-with')

    assert r['Access-Control-Allow-Origin'] == ORIGIN
    assert r['Access-Control-Allow-Credentials'] == 'true'
    assert 'x-requested-with' in r['Access-Control-Allow-Headers'].lower()

    sign_in(api, student)
    answer = api.get(PROFILE, HTTP_ORIGIN=ORIGIN)
    assert answer['Access-Control-Allow-Origin'] == ORIGIN
    assert answer['Access-Control-Allow-Credentials'] == 'true'


# --------------------------------------------------------------------------- #
# refresh
# --------------------------------------------------------------------------- #
def test_refresh_rotates_the_cookies_and_never_shows_a_browser_its_tokens(api, student):
    first = sign_in(api, student)
    old_refresh = cookie(first, 'coursera_refresh').value

    r = api.post(REFRESH, **OUR_PAGE)

    assert r.status_code == 204
    assert r.content == b''
    assert cookie(r, 'coursera_access').value
    assert cookie(r, 'coursera_refresh').value != old_refresh        # rotated
    assert api.get(PROFILE).status_code == 200
    # the old one is dead
    other = type(api)()
    assert other.post(REFRESH, {'refresh': old_refresh}, format='json').status_code == 401


def test_refresh_by_cookie_from_another_site_is_refused(api, student):
    sign_in(api, student)

    assert api.post(REFRESH).status_code == 403
    assert api.post(REFRESH, **ANOTHER_SITE).status_code == 403


def test_refresh_with_the_token_in_the_body_still_gives_tokens_back_while_legacy_is_on(api, student):
    """What the front end of the release before cookies does, once, to move its session over."""
    tokens = sign_in(api, student).json()['tokens']
    api.cookies.clear()

    r = api.post(REFRESH, {'refresh': tokens['refresh']}, format='json')

    assert r.status_code == 200
    assert set(r.json()) == {'access', 'refresh'}
    assert cookie(r, 'coursera_access').value                      # and the session is now a cookie


def test_without_a_session_refresh_is_a_401(api, settings):
    settings.AUTH_LEGACY_TOKEN_TRANSPORT = False

    assert api.post(REFRESH, **OUR_PAGE).status_code == 401


def test_a_deactivated_account_cannot_refresh(api, student):
    sign_in(api, student)
    f.User.objects.filter(pk=student.pk).update(is_active=False)

    assert api.post(REFRESH, **OUR_PAGE).status_code == 401


# --------------------------------------------------------------------------- #
# logout
# --------------------------------------------------------------------------- #
def test_logout_clears_the_cookies_and_blacklists_the_token(api, student):
    first = sign_in(api, student)
    refresh = cookie(first, 'coursera_refresh').value

    r = api.post(LOGOUT, **OUR_PAGE)

    assert r.status_code == 205
    for name in ('coursera_access', 'coursera_refresh'):
        assert cookie(r, name).value == ''
        assert int(cookie(r, name)['max-age']) == 0
    other = type(api)()
    assert other.post(REFRESH, {'refresh': refresh}, format='json').status_code == 401


def test_a_page_of_another_site_cannot_sign_the_user_out(api, student):
    sign_in(api, student)

    assert api.post(LOGOUT, **ANOTHER_SITE).status_code == 403
    assert api.get(PROFILE).status_code == 200


def test_logout_with_a_bad_token_still_clears_the_cookies(api, student):
    api.cookies.clear()

    r = api.post(LOGOUT, {'refresh': 'garbage'}, format='json')

    assert r.status_code == 400
    assert cookie(r, 'coursera_access').value == ''


def test_logout_works_when_the_access_token_has_expired(api, student):
    sign_in(api, student)
    api.cookies['coursera_access'] = 'expired.or.broken'

    assert api.post(LOGOUT, **OUR_PAGE).status_code == 205


# --------------------------------------------------------------------------- #
# sockets
# --------------------------------------------------------------------------- #
def socket(path, headers=()):
    application = import_string(django_settings.ASGI_APPLICATION)
    return WebsocketCommunicator(application, path, headers=list(headers))


def cookie_header(token):
    return (b'cookie', f'coursera_access={token}'.encode())


def connects(path, headers=()):
    async def scenario():
        communicator = socket(path, headers)
        connected, _ = await communicator.connect()
        if connected:
            await communicator.disconnect()
        return connected

    return async_to_sync(scenario)()


@pytest.mark.django_db(transaction=True)
def test_a_socket_opened_by_our_page_is_authenticated_by_the_cookie():
    token = f.access_token_for(f.make_student())

    assert connects('/ws/user/', [cookie_header(token), (b'origin', ORIGIN.encode())]) is True


@pytest.mark.django_db(transaction=True)
def test_a_socket_opened_by_another_site_gets_nothing_from_the_cookie():
    token = f.access_token_for(f.make_student())

    assert connects('/ws/user/', [cookie_header(token), (b'origin', b'https://evil.example')]) is False
    assert connects('/ws/user/', [cookie_header(token)]) is False       # no origin at all


@pytest.mark.django_db(transaction=True)
def test_the_query_token_works_only_while_the_legacy_transport_is_on(settings):
    token = f.access_token_for(f.make_student())

    assert connects(f'/ws/user/?token={token}') is True

    settings.AUTH_LEGACY_TOKEN_TRANSPORT = False
    assert connects(f'/ws/user/?token={token}') is False


# --------------------------------------------------------------------------- #
# configuration checks
# --------------------------------------------------------------------------- #
def run_checks(**overrides):
    from django.core.checks import run_checks as run
    from django.test import override_settings

    with override_settings(**overrides):
        return {issue.id for issue in run(include_deployment_checks=True)
                if issue.id.startswith('accounts.')}


def test_cookie_settings_are_checked():
    assert run_checks(AUTH_COOKIE_SAMESITE='None', AUTH_COOKIE_SECURE=False) >= {'accounts.E002', 'accounts.W001'}
    assert 'accounts.E002' not in run_checks(AUTH_COOKIE_SAMESITE='None', AUTH_COOKIE_SECURE=True)
    assert 'accounts.E001' in run_checks(AUTH_COOKIE_SAMESITE='sideways')
    assert 'accounts.E003' in run_checks(CORS_ALLOW_ALL_ORIGINS=True, CORS_ALLOW_CREDENTIALS=True)
    assert run_checks(AUTH_COOKIE_SECURE=True) == set()
