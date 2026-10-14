"""Demo / debug / duplicate endpoints that were deleted in refactor step S1a.

Each endpoint used to grant subscriptions without payment, expose debug data or
duplicate another endpoint; none of them was called by the frontend.  They must
stay gone (404 for a missing route, 405 for a method that is no longer mapped).
"""
import uuid

import pytest

pytestmark = pytest.mark.django_db

SOME_UUID = str(uuid.uuid4())

REMOVED = [
    ('post', '/api/v1/auth/student/create-subscription/'),
    ('get', '/api/v1/auth/student/debug-subscription/'),
    ('post', '/api/payments/checkout/process/'),
    ('post', '/api/payments/checkout/validate/'),
    ('post', '/api/payments/debug/manual-subscription/'),
    ('post', '/api/payments/debug/test-webhook/'),
    ('post', '/api/payments/debug/test-recurring/'),
    ('post', '/api/v1/notifications/test/'),
    ('post', f'/api/v1/courses/instructor/courses/{SOME_UUID}/publish/'),
    ('get', f'/api/v1/courses/instructor/courses/{SOME_UUID}/test_endpoint/'),
    ('get', '/api/v1/courses/instructor/students/'),
    ('get', '/api/v1/courses/student/stats/'),
    ('get', '/api/v1/courses/student/weekly-progress/'),
    # endpoints no client called, removed before /api/v1/v1 was declared
    ('get', '/api/v1/learning/plus-preview/'),
    ('get', '/api/v1/billing/plans/'),
    ('get', '/api/v1/auth/verify-email/some-token/'),
    ('post', f'/api/v1/assessments/quizzes/{SOME_UUID}/reorder-questions/'),
    ('get', '/admin/'),
]

# routes that stay, with the methods nobody used taken away: 405 for the instructor
UNMAPPED = [
    ('get', f'/api/v1/courses/instructor/sections/{SOME_UUID}/'),
    ('get', f'/api/v1/courses/instructor/sections/{SOME_UUID}/lectures/'),
    ('get', f'/api/v1/courses/instructor/lectures/{SOME_UUID}/'),
    ('put', f'/api/v1/courses/instructor/courses/{SOME_UUID}/'),
]


@pytest.mark.parametrize('method,url', REMOVED, ids=[f'{m.upper()} {u}' for m, u in REMOVED])
def test_endpoint_no_longer_exists(auth_client, student, instructor, admin, method, url):
    """Nobody - whatever the role - can reach a removed endpoint."""
    for user in (student, instructor, admin):
        response = getattr(auth_client(user), method)(url, {}, format='json')
        assert response.status_code == 404, (user.user_type, response.status_code)


@pytest.mark.parametrize('method,url', UNMAPPED, ids=[f'{m.upper()} {u}' for m, u in UNMAPPED])
def test_method_is_no_longer_mapped(auth_client, instructor, method, url):
    """The route exists for other methods, this one answers 405."""
    response = getattr(auth_client(instructor), method)(url, {}, format='json')

    assert response.status_code == 405


def test_plain_delete_of_an_instructor_course_is_not_allowed(auth_client, instructor):
    """Courses are removed with the confirmed ``delete-course`` action only."""
    from factories import make_course

    course = make_course(instructor)

    response = auth_client(instructor).delete(f'/api/v1/courses/instructor/courses/{course.uuid}/')

    assert response.status_code == 405
    course.refresh_from_db()  # still there


def test_delete_course_action_still_works_with_confirmation(auth_client, instructor):
    from factories import make_course

    course = make_course(instructor)
    confirmation = f'{instructor.email}/{course.title}'

    response = auth_client(instructor).post(
        f'/api/v1/courses/instructor/courses/{course.uuid}/delete-course/',
        {'confirmation': confirmation}, format='json')

    assert response.status_code == 200
