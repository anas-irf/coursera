"""Bad input is a 400 with a message, never a 500; and a write is all-or-nothing.

These are the failures that used to surface as a bare 500 (a body that is not an object,
an order that is not a number) or as a half-done write (an account without its profile).
"""
import uuid
from unittest.mock import patch

import pytest

import factories as f

pytestmark = pytest.mark.django_db

SIGNUP = '/api/v1/auth/signup/'
LOGIN = '/api/v1/auth/login/'


def sections_url(course_uuid):
    return f'/api/v1/courses/instructor/courses/{course_uuid}/sections/reorder/'


def lectures_url(section_uuid):
    return f'/api/v1/courses/instructor/sections/{section_uuid}/lectures/reorder/'


# --------------------------------------------------------------------------- #
# reordering
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('body', [
    [],                                              # a JSON array, not an object
    {'section_orders': 'first'},                     # not a list
    {'section_orders': ['x']},                       # a list of something else than objects
    {'section_orders': [{'uuid': 'u', 'order': 'one'}]},
    {'section_orders': [{'uuid': 'u', 'order': True}]},
    {'section_orders': [{'uuid': 'u'}]},
])
def test_a_malformed_section_reorder_is_a_400(auth_client, instructor, body):
    course = f.make_course(instructor)

    r = auth_client(instructor).post(sections_url(course.uuid), body, format='json')

    assert r.status_code == 400
    assert 'error' in r.json()


def test_a_malformed_lecture_reorder_is_a_400(auth_client, instructor):
    section = f.make_section(f.make_course(instructor))

    r = auth_client(instructor).post(
        lectures_url(section.uuid), {'lecture_orders': {'uuid': 'u'}}, format='json')

    assert r.status_code == 400
    assert 'error' in r.json()


def test_reordering_an_unknown_course_is_a_404_and_not_a_400(auth_client, instructor):
    r = auth_client(instructor).post(
        sections_url(uuid.uuid4()), {'section_orders': []}, format='json')

    assert r.status_code == 404


def test_reordering_the_course_of_another_instructor_is_a_404(
        auth_client, instructor, other_instructor):
    course = f.make_course(other_instructor)

    r = auth_client(instructor).post(
        sections_url(course.uuid), {'section_orders': []}, format='json')

    assert r.status_code == 404


def test_reordering_skips_what_is_not_in_the_course(auth_client, instructor):
    course = f.make_course(instructor)
    first, second = f.make_section(course), f.make_section(course)

    r = auth_client(instructor).post(sections_url(course.uuid), {'section_orders': [
        {'uuid': str(second.uuid), 'order': 1},
        {'uuid': str(first.uuid), 'order': 2},
        {'uuid': 'not-a-uuid', 'order': 3},
        {'uuid': str(uuid.uuid4()), 'order': 4},
    ]}, format='json')

    assert r.status_code == 200
    assert f.reload(second).order == 1
    assert f.reload(first).order == 2


# --------------------------------------------------------------------------- #
# request bodies that are not objects
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('body', [[], 'reason', 5])
def test_a_body_that_is_not_an_object_is_a_400_on_a_rejection(auth_client, admin, instructor, body):
    course = f.make_course(instructor, status='pending_review')

    r = auth_client(admin).post(
        f'/api/v1/courses/admin/{course.uuid}/reject/', body, format='json')

    assert r.status_code == 400
    assert 'error' in r.json()


@pytest.mark.parametrize('body', [{}, {'reason': None}, {'reason': '   '}, {'reason': 5}])
def test_a_rejection_needs_a_text_reason(auth_client, admin, instructor, body):
    course = f.make_course(instructor, status='pending_review')

    r = auth_client(admin).post(
        f'/api/v1/courses/admin/{course.uuid}/reject/', body, format='json')

    assert r.status_code == 400
    assert r.json() == {'error': 'Rejection reason is required'}
    assert f.reload(course).status == 'pending_review'


def test_a_checkout_body_that_is_not_an_object_is_a_400(auth_client, student):
    r = auth_client(student).post('/api/v1/billing/checkout/session/', ['monthly'], format='json')

    assert r.status_code == 400
    assert 'error' in r.json()


# --------------------------------------------------------------------------- #
# registration is all or nothing
# --------------------------------------------------------------------------- #
def test_a_failure_while_creating_the_profile_leaves_no_account_behind(api, auth_client):
    payload = {
        'email': 'half.done@example.com', 'password': 'Str0ng-Passw0rd-xyz',
        'confirm_password': 'Str0ng-Passw0rd-xyz', 'user_type': 'student',
        'first_name': 'Half', 'last_name': 'Done',
    }

    with patch('apps.accounts.models.StudentProfile.objects.create',
               side_effect=RuntimeError('profile table is gone')):
        r = auth_client(raise_exceptions=False).post(SIGNUP, payload, format='json')

    assert r.status_code == 500
    assert 'profile table' not in r.content.decode()
    # no user was left behind: the same address can sign up, and could not log in before
    login = api.post(LOGIN, {'email': payload['email'], 'password': payload['password']},
                     format='json')
    assert login.status_code == 401
    assert api.post(SIGNUP, payload, format='json').status_code == 201
