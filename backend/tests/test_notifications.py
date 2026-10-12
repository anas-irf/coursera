"""Engagement slice: notification list / unread count / mark-as-read.

The endpoints live under ``/api/notifications/`` today (they are part
of the courses app)."""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

LIST = '/api/notifications/'
COUNT = '/api/notifications/count/'


def read_url(notification):
    return f'/api/notifications/{notification.id}/read/'


def test_list_returns_only_own_notifications_newest_first(auth_client, student, other_student):
    """The list is scoped to the caller and ordered newest first."""
    old = f.make_notification(student, title='old', age_minutes=30)
    new = f.make_notification(student, title='new', age_minutes=1, notification_type='enrollment',
                              action_url='/student/my-learning')
    f.make_notification(other_student, title='not mine')

    r = auth_client(student).get(LIST)

    assert r.status_code == 200
    rows = r.json()
    assert [row['id'] for row in rows] == [new.id, old.id]
    row = rows[0]
    assert set(row) == {'id', 'type', 'title', 'message', 'is_read', 'created_at', 'read_at',
                        'action_url'}
    assert row['type'] == 'enrollment'
    assert row['is_read'] is False and row['read_at'] is None
    assert row['action_url'] == '/student/my-learning'


def test_list_limit_and_include_read_parameters(auth_client, student):
    """limit and include_read query parameters."""
    for index in range(5):
        f.make_notification(student, title=f'n{index}', age_minutes=index, is_read=index % 2 == 1)
    client = auth_client(student)

    assert len(client.get(LIST).json()) == 5
    limited = client.get(LIST, {'limit': 2}).json()
    assert [row['title'] for row in limited] == ['n0', 'n1']

    unread = client.get(LIST, {'include_read': 'false'}).json()
    assert [row['title'] for row in unread] == ['n0', 'n2', 'n4']
    assert all(row['is_read'] is False for row in unread)

    both = client.get(LIST, {'include_read': 'false', 'limit': 1}).json()
    assert [row['title'] for row in both] == ['n0']
    assert len(client.get(LIST, {'include_read': 'true'}).json()) == 5


@pytest.mark.pinned_bug
def test_list_with_a_non_numeric_limit_is_a_500_current_behaviour(auth_client, student):
    """A non-numeric limit is answered with a 500 payload."""
    f.make_notification(student)

    r = auth_client(student).get(LIST, {'limit': 'many'})

    assert r.status_code == 500
    assert 'error' in r.json()


def test_unread_count(auth_client, student, other_student):
    """unread_count counts only the caller's unread notifications."""
    f.make_notification(student, is_read=False)
    f.make_notification(student, is_read=False)
    f.make_notification(student, is_read=True)
    f.make_notification(other_student, is_read=False)

    r = auth_client(student).get(COUNT)

    assert r.status_code == 200
    assert r.json() == {'unread_count': 2}


def test_mark_read_updates_only_the_owners_notification(auth_client, student, other_student):
    """mark-read works for the owner; foreign / unknown ids are 404."""
    mine = f.make_notification(student)
    theirs = f.make_notification(other_student)
    client = auth_client(student)

    r = client.post(read_url(mine))

    assert r.status_code == 200
    assert 'message' in r.json()
    mine.refresh_from_db()
    assert mine.is_read is True
    assert mine.read_at is not None
    assert client.get(COUNT).json() == {'unread_count': 0}

    # marking twice is harmless
    assert client.post(read_url(mine)).status_code == 200

    # somebody else's / unknown notification
    r = client.post(read_url(theirs))
    assert r.status_code == 404
    assert 'error' in r.json()
    theirs.refresh_from_db()
    assert theirs.is_read is False
    assert client.post('/api/notifications/999999/read/').status_code == 404


def test_notification_endpoints_require_authentication_but_no_particular_role(
        api, auth_client, instructor, admin):
    """Any authenticated role may use the notification endpoints."""
    for url in (LIST, COUNT):
        assert api.get(url).status_code == 401
    assert api.post('/api/notifications/1/read/').status_code == 401

    for user in (instructor, admin):
        f.make_notification(user)
        client = auth_client(user)
        assert client.get(LIST).status_code == 200
        assert client.get(COUNT).json() == {'unread_count': 1}
