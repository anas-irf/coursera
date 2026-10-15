"""Identity slice: signup, login, profile, logout, token refresh, email verification.

Characterization tests - they pin what the API does today.  Authentication uses
the real ``/api/v1/auth/login/`` endpoint and real simplejwt tokens.
"""
import uuid

import pytest
from rest_framework_simplejwt.tokens import AccessToken

import factories as f

pytestmark = pytest.mark.django_db

SIGNUP = '/api/v1/auth/signup/'
LOGIN = '/api/v1/auth/login/'
LOGOUT = '/api/v1/auth/logout/'
REFRESH = '/api/v1/auth/token/refresh/'
PROFILE = '/api/v1/auth/profile/'


def signup_payload(**overrides):
    data = {
        'email': f'new-{uuid.uuid4().hex[:8]}@example.com',
        'password': f.DEFAULT_PASSWORD,
        'confirm_password': f.DEFAULT_PASSWORD,
        'user_type': 'student',
        'first_name': 'New',
        'last_name': 'Person',
    }
    data.update(overrides)
    return data


def do_login(api, email, password=f.DEFAULT_PASSWORD):
    return api.post(LOGIN, {'email': email, 'password': password}, format='json')


# --------------------------------------------------------------------------- #
# signup
# --------------------------------------------------------------------------- #
def test_signup_student_returns_user_tokens_and_creates_profile(api):
    """Student signup: 201, user + tokens and a student profile."""
    payload = signup_payload()
    r = api.post(SIGNUP, payload, format='json')

    assert r.status_code == 201
    body = r.json()
    assert set(body) >= {'user', 'tokens', 'message'}
    assert set(body['tokens']) == {'refresh', 'access'}
    assert body['user']['email'] == payload['email']
    assert body['user']['user_type'] == 'student'
    assert body['user']['email_verified'] is False
    assert {'id', 'uuid', 'full_name'} <= set(body['user'])
    assert 'password' not in body['user']

    user = f.User.objects.get(email=payload['email'])
    assert user.check_password(payload['password'])
    assert f.StudentProfile.objects.filter(user=user).exists()
    assert not f.InstructorProfile.objects.filter(user=user).exists()
    assert user.email_verified is False


def test_signup_instructor_creates_instructor_profile(api):
    """Instructor signup creates an instructor profile."""
    payload = signup_payload(user_type='instructor')
    r = api.post(SIGNUP, payload, format='json')

    assert r.status_code == 201
    assert r.json()['user']['user_type'] == 'instructor'
    user = f.User.objects.get(email=payload['email'])
    assert f.InstructorProfile.objects.filter(user=user).exists()
    assert not f.StudentProfile.objects.filter(user=user).exists()


def test_signup_defaults_to_student_when_user_type_missing(api):
    """Without user_type the account is a student."""
    payload = signup_payload()
    payload.pop('user_type')
    r = api.post(SIGNUP, payload, format='json')

    assert r.status_code == 201
    assert r.json()['user']['user_type'] == 'student'


def test_signup_rejects_admin_user_type(api):
    """user_type "admin" is refused."""
    payload = signup_payload(user_type='admin')
    r = api.post(SIGNUP, payload, format='json')

    assert r.status_code == 400
    assert 'user_type' in r.json()
    assert not f.User.objects.filter(email=payload['email']).exists()


def test_signup_rejects_password_mismatch(api):
    """password != confirm_password is a 400."""
    payload = signup_payload(confirm_password='Different-Passw0rd!y')
    r = api.post(SIGNUP, payload, format='json')

    assert r.status_code == 400
    assert 'password' in r.json()
    assert not f.User.objects.filter(email=payload['email']).exists()


def test_signup_rejects_weak_password_and_duplicate_email(api):
    """Django password validators and e-mail uniqueness apply."""
    weak = signup_payload(password='12345678', confirm_password='12345678')
    r = api.post(SIGNUP, weak, format='json')
    assert r.status_code == 400
    assert 'password' in r.json()

    existing = f.make_student()
    r = api.post(SIGNUP, signup_payload(email=existing.email), format='json')
    assert r.status_code == 400
    assert 'email' in r.json()


# --------------------------------------------------------------------------- #
# login
# --------------------------------------------------------------------------- #
def test_login_success_returns_user_profile_and_tokens_with_custom_claims(api):
    """Login returns user, profile and tokens carrying user_type / uuid claims."""
    student = f.make_student()
    r = do_login(api, student.email)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'user', 'profile', 'tokens'}
    assert body['user']['email'] == student.email
    assert body['profile'] is not None
    assert {'learning_streak', 'preferred_language'} <= set(body['profile'])
    assert set(body['tokens']) == {'refresh', 'access'}

    claims = AccessToken(body['tokens']['access'])
    assert claims['user_type'] == 'student'
    assert claims['uuid'] == str(student.uuid)
    assert str(claims['user_id']) == str(student.id)

    student.refresh_from_db()
    assert student.last_login_ip  # recorded by the view


def test_login_instructor_profile_is_the_instructor_profile(api):
    """Instructors get their instructor profile in the login payload."""
    instructor = f.make_instructor()
    r = do_login(api, instructor.email)

    assert r.status_code == 200
    profile = r.json()['profile']
    assert profile is not None
    assert {'verified_instructor', 'earnings_total'} <= set(profile)


def test_login_without_profile_returns_null_profile(api):
    """No profile row -> ``profile`` is null."""
    user = f.make_student(profile=False)
    r = do_login(api, user.email)

    assert r.status_code == 200
    assert r.json()['profile'] is None


def test_login_rejects_bad_password_unknown_user_and_missing_fields(api):
    """Wrong credentials 401, missing fields 400."""
    student = f.make_student()

    r = do_login(api, student.email, 'wrong-password')
    assert r.status_code == 401
    assert r.json() == {'error': 'Invalid credentials'}

    r = do_login(api, 'nobody@example.com')
    assert r.status_code == 401

    r = api.post(LOGIN, {'email': student.email}, format='json')
    assert r.status_code == 400
    assert 'password' in r.json()


def test_login_inactive_user_is_a_plain_401(api):
    """An inactive account is answered exactly like a wrong password: the backend
    refuses it before the view runs, so nothing discloses the state of the account."""
    user = f.make_student()
    user.is_active = False
    user.save()

    r = do_login(api, user.email)

    assert r.status_code == 401
    assert r.json() == {'error': 'Invalid credentials'}


# --------------------------------------------------------------------------- #
# profile / authentication
# --------------------------------------------------------------------------- #
def test_profile_with_bearer_token_from_real_login(api):
    """GET profile with a real access token."""
    student = f.make_student()
    access = do_login(api, student.email).json()['tokens']['access']

    api.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    r = api.get(PROFILE)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'user', 'profile'}
    assert body['user']['email'] == student.email
    assert body['profile'] is not None


def test_endpoints_require_a_valid_token(api):
    """Missing or garbage bearer tokens are 401."""
    assert api.get(PROFILE).status_code == 401
    assert api.get('/api/v1/learning/enrolled/').status_code == 401

    api.credentials(HTTP_AUTHORIZATION='Bearer not-a-real-token')
    assert api.get(PROFILE).status_code == 401


# --------------------------------------------------------------------------- #
# logout / refresh
# --------------------------------------------------------------------------- #
def test_logout_blacklists_the_refresh_token(api):
    """Logout answers 205 and the refresh token stops working."""
    student = f.make_student()
    tokens = do_login(api, student.email).json()['tokens']
    api.cookies.clear()
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    r = api.post(LOGOUT, {'refresh': tokens['refresh']}, format='json')
    assert r.status_code == 205
    assert 'message' in r.json()

    api.credentials()  # the refresh endpoint is public
    r = api.post(REFRESH, {'refresh': tokens['refresh']}, format='json')
    assert r.status_code == 401


def test_logout_is_authenticated_by_the_refresh_token_and_a_bad_one_is_a_400(api):
    """Signing out must work when the access token has expired, so the credential is the refresh
    token; one that is not valid is a 400."""
    student = f.make_student()
    tokens = do_login(api, student.email).json()['tokens']
    api.cookies.clear()

    r = api.post(LOGOUT, {'refresh': 'garbage'}, format='json')
    assert r.status_code == 400
    assert r.json() == {'error': 'Invalid or expired refresh token'}

    # no access token at all, and it still works
    assert api.post(LOGOUT, {'refresh': tokens['refresh']}, format='json').status_code == 205
    assert api.post(REFRESH, {'refresh': tokens['refresh']}, format='json').status_code == 401


def test_token_refresh_rotates_and_blacklists_the_old_refresh_token(api):
    """Refresh returns a new refresh token and blacklists the old one."""
    student = f.make_student()
    old_refresh = do_login(api, student.email).json()['tokens']['refresh']
    api.cookies.clear()

    r = api.post(REFRESH, {'refresh': old_refresh}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'access', 'refresh'}
    assert body['refresh'] != old_refresh  # ROTATE_REFRESH_TOKENS

    # the new access token works ...
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert api.get(PROFILE).status_code == 200
    # ... the old refresh token is dead (BLACKLIST_AFTER_ROTATION)
    api.credentials()
    assert api.post(REFRESH, {'refresh': old_refresh}, format='json').status_code == 401
    # ... and the rotated one can be used once more
    assert api.post(REFRESH, {'refresh': body['refresh']}, format='json').status_code == 200
