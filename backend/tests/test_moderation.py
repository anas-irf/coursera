"""Moderation slice: admin review queue, approve / reject, admin listings."""
import uuid

import pytest

import factories as f

pytestmark = pytest.mark.django_db

PENDING = '/api/v1/courses/admin/pending/'
ALL_COURSES = '/api/v1/courses/admin/all/'
ALL_USERS = '/api/v1/insights/admin/users/'


def approve_url(course):
    return f'/api/v1/courses/admin/{course.uuid}/approve/'


def reject_url(course):
    return f'/api/v1/courses/admin/{course.uuid}/reject/'


@pytest.fixture
def pending_bundle(instructor):
    """A complete course (weights 40 + 60) waiting for review."""
    return f.build_course(instructor, status='pending_review', title='Awaiting review')


# --------------------------------------------------------------------------- #
# review queue
# --------------------------------------------------------------------------- #
def test_admin_pending_list_only_contains_pending_courses(auth_client, admin, instructor, pending_bundle):
    """The review queue lists pending courses with grade-weight totals."""
    f.build_course(instructor, status='draft', title='A draft')
    f.build_course(instructor, status='published', title='Already live')

    r = auth_client(admin).get(PENDING)

    assert r.status_code == 200
    rows = r.json()
    assert [row['id'] for row in rows] == [str(pending_bundle.course.uuid)]
    row = rows[0]
    assert set(row) == {'id', 'title', 'instructor', 'category', 'course_type',
                        'submitted_date', 'sections_count', 'lectures_count',
                        'total_weight', 'description', 'thumbnail', 'duration_hours'}
    assert set(row['instructor']) == {'id', 'name', 'email'}
    assert row['instructor']['email'] == instructor.email
    assert row['total_weight'] == pytest.approx(100.0)
    assert row['sections_count'] == 1
    assert row['lectures_count'] == 4
    assert row['category'] == 'Uncategorized'


def test_moderation_endpoints_are_admin_only(api, auth_client, student, instructor, pending_bundle):
    """Students and instructors get 403, anonymous 401."""
    endpoints = [
        ('get', PENDING), ('get', ALL_COURSES), ('get', ALL_USERS),
        ('post', approve_url(pending_bundle.course)),
        ('post', reject_url(pending_bundle.course)),
    ]
    for user in (student, instructor):
        client = auth_client(user)
        for method, url in endpoints:
            r = client.get(url) if method == 'get' else client.post(url, {'reason': 'x'}, format='json')
            assert r.status_code == 403, (user.user_type, url)

    for method, url in endpoints:
        r = api.get(url) if method == 'get' else api.post(url, {}, format='json')
        assert r.status_code == 401, url

    pending_bundle.course.refresh_from_db()
    assert pending_bundle.course.status == 'pending_review'


def test_superuser_flag_also_grants_admin_access(auth_client):
    """is_superuser users pass the admin permission."""
    boss = f.make_user('student', is_superuser=True)

    assert auth_client(boss).get(PENDING).status_code == 200


# --------------------------------------------------------------------------- #
# approve
# --------------------------------------------------------------------------- #
def test_admin_approves_course(auth_client, admin, instructor, pending_bundle):
    """Approve publishes the course and notifies the instructor (and the admin)."""
    course = pending_bundle.course
    course.rejection_reason = 'old reason'
    course.save()

    r = auth_client(admin).post(approve_url(course))

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'message', 'course_id', 'published_date'}
    assert body['course_id'] == str(course.uuid)

    course.refresh_from_db()
    assert course.status == 'published'
    assert course.published_date is not None
    assert course.rejection_reason is None

    note = f.Notification.objects.get(recipient=instructor, notification_type='course_approved')
    assert note.is_read is False
    assert note.object_id == str(course.uuid)
    assert note.action_url == '/instructor/courses'
    # the approving admin also gets a record-keeping notification
    assert f.Notification.objects.filter(recipient=admin, notification_type='course_approved').count() == 1


def test_approved_course_becomes_visible_in_public_catalogue(api, auth_client, admin, pending_bundle):
    """An approved course appears in the public catalogue."""
    assert api.get('/api/v1/learning/courses/').json() == []

    assert auth_client(admin).post(approve_url(pending_bundle.course)).status_code == 200

    ids = [row['id'] for row in api.get('/api/v1/learning/courses/').json()]
    assert ids == [str(pending_bundle.course.uuid)]


# --------------------------------------------------------------------------- #
# reject
# --------------------------------------------------------------------------- #
def test_reject_requires_a_reason(auth_client, admin, pending_bundle):
    """Reject without a reason is a 400."""
    client = auth_client(admin)

    for payload in ({}, {'reason': ''}, {'reason': '   '}):
        r = client.post(reject_url(pending_bundle.course), payload, format='json')
        assert r.status_code == 400
        assert 'error' in r.json()

    pending_bundle.course.refresh_from_db()
    assert pending_bundle.course.status == 'pending_review'


def test_admin_rejects_course_with_reason(auth_client, admin, instructor, pending_bundle):
    """Reject stores reason / date / admin and notifies the instructor."""
    course = pending_bundle.course

    r = auth_client(admin).post(reject_url(course), {'reason': '  Audio is unclear  '}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'message', 'course_id', 'reason', 'rejected_by', 'rejection_date'}
    assert body['course_id'] == str(course.uuid)

    course.refresh_from_db()
    assert course.status == 'rejected'
    assert course.rejection_reason == 'Audio is unclear'
    assert course.rejection_date is not None
    assert course.rejected_by_id == admin.id

    note = f.Notification.objects.get(recipient=instructor, notification_type='course_rejected')
    assert 'Audio is unclear' in note.message
    assert note.action_url == '/instructor/courses'
    assert f.Notification.objects.filter(recipient=admin, notification_type='course_rejected').count() == 1


def test_rejected_course_can_be_resubmitted_and_approved(auth_client, admin, instructor, pending_bundle):
    """Reject -> resubmit -> approve round trip."""
    course = pending_bundle.course
    assert auth_client(admin).post(reject_url(course), {'reason': 'Fix it'}, format='json').status_code == 200

    r = auth_client(instructor).post(f'/api/v1/courses/instructor/courses/{course.uuid}/apply_for_publish/')
    assert r.status_code == 200
    assert auth_client(admin).post(approve_url(course)).status_code == 200

    course.refresh_from_db()
    assert course.status == 'published'
    assert course.rejection_reason is None and course.rejected_by_id is None


# --------------------------------------------------------------------------- #
# non-pending / unknown courses
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('status', ['draft', 'published', 'rejected'])
def test_approve_and_reject_non_pending_course_is_a_404(auth_client, admin, instructor, status):
    """Only courses waiting for review can be approved / rejected.  (The views
    used to answer 500 because Http404 was swallowed; fixed in refactor step S4.)"""
    course = f.make_course(instructor, status=status)
    client = auth_client(admin)

    assert client.post(approve_url(course)).status_code == 404
    assert client.post(reject_url(course), {'reason': 'because'}, format='json').status_code == 404

    course.refresh_from_db()
    assert course.status == status
    assert f.Notification.objects.filter(recipient=instructor).count() == 0


def test_approve_unknown_course_is_a_404(auth_client, admin):
    r = auth_client(admin).post(f'/api/v1/courses/admin/{uuid.uuid4()}/approve/')

    assert r.status_code == 404


# --------------------------------------------------------------------------- #
# admin listings
# --------------------------------------------------------------------------- #
def test_admin_lists_all_courses_regardless_of_status(auth_client, admin, instructor):
    """The admin course list shows every status with the documented keys."""
    statuses = ['draft', 'pending_review', 'published', 'rejected']
    for status in statuses:
        f.build_course(instructor, status=status)

    r = auth_client(admin).get(ALL_COURSES)

    assert r.status_code == 200
    rows = r.json()
    assert sorted(row['status'] for row in rows) == sorted(statuses)
    assert set(rows[0]) == {'id', 'title', 'instructor', 'category', 'course_type',
                            'status', 'created_date', 'published_date', 'sections_count',
                            'lectures_count', 'total_weight', 'total_enrolled',
                            'average_rating', 'description', 'thumbnail', 'duration_hours'}
    published = [row for row in rows if row['status'] == 'published'][0]
    assert published['published_date'] is not None
    assert published['total_weight'] == pytest.approx(100.0)


def test_admin_lists_all_users_with_type_specific_stats(auth_client, admin, instructor, student):
    """The admin user list adds student / instructor / admin specific fields."""
    course = f.build_course(instructor, status='published').course
    f.enroll(student, course)

    r = auth_client(admin).get(ALL_USERS)

    assert r.status_code == 200
    rows = {row['email']: row for row in r.json()}
    assert set(rows) == {admin.email, instructor.email, student.email}

    common = {'id', 'name', 'email', 'user_type', 'join_date', 'last_login', 'is_active',
              'status', 'phone_number', 'email_verified', 'avatar'}
    for row in rows.values():
        assert common <= set(row)

    assert {'courses_enrolled', 'completed_courses', 'active_courses'} <= set(rows[student.email])
    assert rows[student.email]['courses_enrolled'] == 1
    assert {'courses_created', 'published_courses', 'draft_courses',
            'students_taught'} <= set(rows[instructor.email])
    assert rows[instructor.email]['students_taught'] == 1
    assert {'is_superuser', 'is_admin'} <= set(rows[admin.email])
    assert rows[admin.email]['is_admin'] is True
