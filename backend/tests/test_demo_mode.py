"""Demo mode: the one-click sign-in of a portfolio demo, and the uploads served by Django itself."""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

DEMO = '/api/v1/auth/demo/'
DEMO_LOGIN = '/api/v1/auth/demo/login/'
PROFILE = '/api/v1/auth/profile/'


@pytest.fixture
def demo_cast(settings):
    """The three demo accounts of the settings, as ``{role: user}``."""
    settings.DEMO_MODE = True
    return {
        'student': f.make_student(email=settings.DEMO_ACCOUNTS['student'], first_name='Demo', last_name='Student'),
        'instructor': f.make_instructor(email=settings.DEMO_ACCOUNTS['instructor'], first_name='Demo',
                                        last_name='Instructor'),
        'admin': f.make_admin(email=settings.DEMO_ACCOUNTS['admin'], first_name='Demo', last_name='Admin'),
    }


def test_outside_demo_mode_the_login_page_offers_nothing(api, settings):
    settings.DEMO_MODE = False
    f.make_student(email=settings.DEMO_ACCOUNTS['student'])

    r = api.get(DEMO)

    assert r.status_code == 200
    assert r.json() == {'enabled': False, 'accounts': []}


def test_in_demo_mode_the_accounts_are_listed_student_first(api, demo_cast):
    body = api.get(DEMO).json()

    assert body['enabled'] is True
    assert [row['role'] for row in body['accounts']] == ['student', 'instructor', 'admin']
    student = body['accounts'][0]
    assert set(student) == {'role', 'email', 'name', 'headline'}
    assert student['email'] == 'demo.student@example.com' and student['name'] == 'Demo Student'
    assert all(row['headline'] for row in body['accounts'])


def test_an_account_that_is_missing_or_deactivated_is_not_offered(api, demo_cast):
    demo_cast['instructor'].is_active = False
    demo_cast['instructor'].save()
    demo_cast['admin'].delete()

    body = api.get(DEMO).json()

    assert [row['role'] for row in body['accounts']] == ['student']


@pytest.mark.parametrize('role', ['student', 'instructor', 'admin'])
def test_a_visitor_signs_in_as_a_demo_account_without_a_password(api, demo_cast, role):
    r = api.post(DEMO_LOGIN, {'role': role}, format='json')

    assert r.status_code == 200
    assert r.json()['user']['email'] == demo_cast[role].email
    assert r.json()['user']['user_type'] == role
    assert r.cookies['coursera_access'].value and r.cookies['coursera_refresh'].value
    assert f.reload(demo_cast[role]).last_login is not None
    # the cookies are a real session
    assert api.get(PROFILE).json()['user']['email'] == demo_cast[role].email


def test_the_tokens_are_in_the_body_only_for_bearer_callers(api, demo_cast, settings):
    settings.AUTH_LEGACY_TOKEN_TRANSPORT = False

    assert set(api.post(DEMO_LOGIN, {'role': 'student'}, format='json').json()) == {'user', 'profile'}
    bearer = api.post(DEMO_LOGIN, {'role': 'student'}, format='json', HTTP_X_AUTH_TRANSPORT='bearer')
    assert set(bearer.json()['tokens']) == {'access', 'refresh'}


def test_outside_demo_mode_the_demo_sign_in_does_not_exist(api, demo_cast, settings):
    settings.DEMO_MODE = False

    r = api.post(DEMO_LOGIN, {'role': 'student'}, format='json')

    assert r.status_code == 404
    assert 'coursera_access' not in r.cookies


def test_a_role_that_is_not_offered_is_a_field_error(api, demo_cast):
    r = api.post(DEMO_LOGIN, {'role': 'superuser'}, format='json')

    assert r.status_code == 400 and 'role' in r.json()
    assert api.post(DEMO_LOGIN, ['student'], format='json').status_code == 400


def test_a_deactivated_demo_account_cannot_be_signed_in_to(api, demo_cast):
    demo_cast['student'].is_active = False
    demo_cast['student'].save()

    assert api.post(DEMO_LOGIN, {'role': 'student'}, format='json').status_code == 404


def test_the_demo_sign_in_ignores_a_stale_session(api, demo_cast):
    api.cookies['coursera_access'] = 'expired.or.broken'

    assert api.post(DEMO_LOGIN, {'role': 'admin'}, format='json').status_code == 200


# --------------------------------------------------------------------------- #
# the uploads of a single-process demo
# --------------------------------------------------------------------------- #
def test_uploads_are_not_served_by_django_by_default(api, settings, tmp_path):
    (tmp_path / 'hello.txt').write_text('hello', encoding='utf-8')
    settings.MEDIA_ROOT = str(tmp_path)

    assert api.get('/media/hello.txt').status_code == 404


def test_with_serve_media_the_uploads_are_served(api, settings, tmp_path):
    settings.ROOT_URLCONF = 'urls_with_media'      # what config.urls builds with SERVE_MEDIA on
    (tmp_path / 'course_thumbnails').mkdir()
    (tmp_path / 'course_thumbnails' / 'cover.txt').write_text('a picture', encoding='utf-8')
    settings.MEDIA_ROOT = str(tmp_path)

    r = api.get('/media/course_thumbnails/cover.txt')

    assert r.status_code == 200
    assert b''.join(r.streaming_content) == b'a picture'
    assert api.get('/media/missing.txt').status_code == 404
