"""Role / permission matrix.

One representative endpoint per permission class, called as an anonymous user
and as each role.  Pins the behaviour of the single role-permission module.
"""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

# endpoint -> set of roles that get through (everybody else: 403, anonymous: 401)
STUDENT_ONLY = '/api/courses/enrolled/'
INSTRUCTOR_ONLY = '/api/courses/instructor/courses/'
ADMIN_ONLY = '/api/courses/admin/pending/'
ANY_AUTHENTICATED = '/api/auth/profile/'


@pytest.mark.parametrize('url,allowed', [
    (STUDENT_ONLY, {'student'}),
    (INSTRUCTOR_ONLY, {'instructor'}),
    (ADMIN_ONLY, {'admin'}),
    (ANY_AUTHENTICATED, {'student', 'instructor', 'admin'}),
])
def test_role_matrix(api, auth_client, student, instructor, admin, url, allowed):
    users = {'student': student, 'instructor': instructor, 'admin': admin}

    assert api.get(url).status_code == 401

    for role, user in users.items():
        response = auth_client(user).get(url)
        expected = 200 if role in allowed else 403
        assert response.status_code == expected, (url, role, response.status_code)


def test_superuser_counts_as_admin_whatever_the_user_type(auth_client):
    """``IsAdmin`` follows ``User.is_admin`` (user_type admin OR superuser)."""
    user = f.make_user('student', email='root@example.com')
    user.is_superuser = True
    user.save()

    assert auth_client(user).get(ADMIN_ONLY).status_code == 200
    # ... but the student-only endpoint still sees a student
    assert auth_client(user).get(STUDENT_ONLY).status_code == 200


def test_permission_classes_are_defined_once():
    """The role classes used by the views are the ones from accounts.permissions."""
    from apps.accounts import permissions
    from apps.assessments import views as assessment_views
    from apps.courses import student_views, views as course_views

    assert course_views.IsInstructor is permissions.IsInstructor
    assert course_views.IsStudent is permissions.IsStudent
    assert course_views.IsAdmin is permissions.IsAdmin
    assert student_views.IsStudent is permissions.IsStudent
    assert assessment_views.IsInstructor is permissions.IsInstructor
