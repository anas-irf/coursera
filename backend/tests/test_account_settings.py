"""The account page: a user changes their own profile and their password."""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

LOGIN = '/api/v1/auth/login/'
PROFILE = '/api/v1/auth/profile/'
PASSWORD = '/api/v1/auth/password/'
REFRESH = '/api/v1/auth/token/refresh/'
NEW_PASSWORD = 'An0ther-Str0ng-Passw0rd'


# --------------------------------------------------------------------------- #
# the profile
# --------------------------------------------------------------------------- #
def test_the_profile_shows_what_the_account_page_edits(auth_client, instructor):
    user = auth_client(instructor).get(PROFILE).json()['user']

    assert {'bio', 'country', 'city', 'expertise', 'linkedin_url', 'website_url', 'years_of_experience',
            'date_joined'} <= set(user)


def test_a_student_changes_their_names_details_and_learning_profile(auth_client, student):
    r = auth_client(student).patch(PROFILE, {
        'first_name': 'Ada', 'last_name': 'Lovelace', 'phone_number': '+441234567890',
        'bio': 'Counts things.', 'country': 'United Kingdom', 'city': 'London',
        'learning_goals': 'Write a first program.', 'interests': ['Python', 'Data science'],
    }, format='json')

    assert r.status_code == 200
    body = r.json()
    assert body['user']['full_name'] == 'Ada Lovelace'
    assert body['user']['city'] == 'London' and body['user']['bio'] == 'Counts things.'
    assert body['profile']['learning_goals'] == 'Write a first program.'
    assert body['profile']['interests'] == ['Python', 'Data science']
    student = f.reload(student)
    assert (student.first_name, student.phone_number) == ('Ada', '+441234567890')


def test_an_instructor_changes_the_teaching_profile_and_the_payout_address(auth_client, instructor):
    r = auth_client(instructor).patch(PROFILE, {
        'expertise': 'Statistics', 'years_of_experience': 12, 'linkedin_url': 'https://linkedin.com/in/ada',
        'website_url': '', 'payout_email': 'pay@example.com',
    }, format='json')

    assert r.status_code == 200
    body = r.json()
    assert body['user']['expertise'] == 'Statistics' and body['user']['years_of_experience'] == 12
    assert body['user']['linkedin_url'] == 'https://linkedin.com/in/ada'
    assert body['user']['website_url'] is None            # a blank link is no link
    assert body['profile']['payout_email'] == 'pay@example.com'


def test_the_fields_of_another_role_are_ignored(auth_client, student, instructor):
    auth_client(student).patch(PROFILE, {'expertise': 'Hacking', 'payout_email': 'me@example.com'}, format='json')
    auth_client(instructor).patch(PROFILE, {'learning_goals': 'none', 'interests': ['x']}, format='json')

    assert f.reload(student).expertise == ''
    assert f.InstructorProfile.objects.get(user=instructor).payout_email == ''


def test_an_admin_has_no_role_profile_and_may_still_change_the_common_fields(auth_client, admin):
    r = auth_client(admin).patch(PROFILE, {'city': 'Lisbon'}, format='json')

    assert r.status_code == 200
    assert r.json()['user']['city'] == 'Lisbon' and r.json()['profile'] is None


def test_a_missing_role_profile_is_created_when_it_is_filled_in(auth_client):
    student = f.make_student(profile=False)

    r = auth_client(student).patch(PROFILE, {'learning_goals': 'Finish one course'}, format='json')

    assert r.status_code == 200
    assert f.StudentProfile.objects.get(user=student).learning_goals == 'Finish one course'


@pytest.mark.parametrize('changes,field', [
    ({'first_name': ''}, 'first_name'),
    ({'phone_number': '12ab'}, 'phone_number'),
    ({'bio': 'x' * 501}, 'bio'),
    ({'years_of_experience': 81}, 'years_of_experience'),
    ({'linkedin_url': 'not a link'}, 'linkedin_url'),
    ({'interests': ['x'] * 11}, 'interests'),
])
def test_bad_values_are_a_field_map_and_change_nothing(auth_client, instructor, changes, field):
    before = f.reload(instructor).first_name

    r = auth_client(instructor).patch(PROFILE, changes, format='json')

    assert r.status_code == 400
    assert field in r.json()
    assert f.reload(instructor).first_name == before


def test_a_body_that_is_not_an_object_is_a_400(auth_client, student):
    assert auth_client(student).patch(PROFILE, ['first_name'], format='json').status_code == 400


def test_nobody_changes_a_profile_anonymously(api):
    assert api.patch(PROFILE, {'first_name': 'X'}, format='json').status_code == 401


# --------------------------------------------------------------------------- #
# the password
# --------------------------------------------------------------------------- #
def sign_in(api, user, password=f.DEFAULT_PASSWORD):
    return api.post(LOGIN, {'email': user.email, 'password': password}, format='json')


def test_the_password_changes_and_the_browser_gets_fresh_session_cookies(api, auth_client, student):
    old_refresh = sign_in(api, student).json()['tokens']['refresh']

    r = auth_client(student).post(PASSWORD, {'current_password': f.DEFAULT_PASSWORD,
                                             'new_password': NEW_PASSWORD}, format='json')

    assert r.status_code == 200
    assert r.json() == {'message': 'Your password was changed.'}
    assert r.cookies['coursera_access'].value and r.cookies['coursera_refresh'].value
    assert f.reload(student).check_password(NEW_PASSWORD)
    assert sign_in(api, student).status_code == 401
    assert sign_in(api, student, NEW_PASSWORD).status_code == 200
    # the session of another browser cannot be renewed any more
    assert api.post(REFRESH, {'refresh': old_refresh}, format='json').status_code == 401


def test_a_wrong_current_password_is_refused(auth_client, student):
    r = auth_client(student).post(PASSWORD, {'current_password': 'not-it', 'new_password': NEW_PASSWORD},
                                  format='json')

    assert r.status_code == 400 and 'current_password' in r.json()
    assert f.reload(student).check_password(f.DEFAULT_PASSWORD)


@pytest.mark.parametrize('new_password', ['short', '12345678901', f.DEFAULT_PASSWORD])
def test_a_weak_or_unchanged_new_password_is_refused(auth_client, student, new_password):
    r = auth_client(student).post(PASSWORD, {'current_password': f.DEFAULT_PASSWORD,
                                             'new_password': new_password}, format='json')

    assert r.status_code == 400 and 'new_password' in r.json()
    assert f.reload(student).check_password(f.DEFAULT_PASSWORD)


def test_a_demo_account_keeps_its_password_in_demo_mode(auth_client, settings):
    settings.DEMO_MODE = True
    demo = f.make_student(email=settings.DEMO_ACCOUNTS['student'])

    r = auth_client(demo).post(PASSWORD, {'current_password': f.DEFAULT_PASSWORD,
                                          'new_password': NEW_PASSWORD}, format='json')

    assert r.status_code == 403
    assert r.json()['code'] == 'demo_account'
    assert f.reload(demo).check_password(f.DEFAULT_PASSWORD)


def test_outside_demo_mode_the_demo_address_is_an_account_like_any_other(auth_client, settings):
    settings.DEMO_MODE = False
    demo = f.make_student(email=settings.DEMO_ACCOUNTS['student'])

    r = auth_client(demo).post(PASSWORD, {'current_password': f.DEFAULT_PASSWORD,
                                          'new_password': NEW_PASSWORD}, format='json')

    assert r.status_code == 200


def test_nobody_changes_a_password_anonymously(api):
    assert api.post(PASSWORD, {'current_password': 'a', 'new_password': 'b'}, format='json').status_code == 401


def test_signing_in_records_when(api, student):
    assert student.last_login is None

    sign_in(api, student)

    assert f.reload(student).last_login is not None
