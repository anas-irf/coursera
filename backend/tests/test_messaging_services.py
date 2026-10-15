"""Messaging services and selectors (refactor step S6)."""
import pytest

import factories as f
from apps.core.api.errors import NotFound, ServiceError
from apps.messaging import selectors, services

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _classroom(request, db):
    """The people of these tests know each other: the instructor teaches a course the students take."""
    names = request.fixturenames
    if 'instructor' not in names:
        return
    students = [request.getfixturevalue(name) for name in ('student', 'other_student') if name in names]
    if not students:
        return
    course = f.make_course(request.getfixturevalue('instructor'), status='published')
    for learner in students:
        f.enroll(learner, course)


def test_send_message_trims_stores_and_returns_the_message(student, instructor):
    message = services.send_message(student, instructor.id, '  hi there  ')

    assert message.content == 'hi there'
    assert (message.sender_id, message.recipient_id) == (student.id, instructor.id)
    assert message.conversation_id == f.DirectMessage.get_conversation_id(student, instructor)


@pytest.mark.parametrize('recipient, content', [
    (None, 'x'), ('', 'x'), (1, ''), (1, '   '), (1, None), (1, 42),
])
def test_send_message_rejects_missing_parts(student, recipient, content):
    with pytest.raises(ServiceError) as excinfo:
        services.send_message(student, recipient, content)

    assert not isinstance(excinfo.value, NotFound)
    assert f.DirectMessage.objects.count() == 0


@pytest.mark.parametrize('recipient', [999999, 'abc'])
def test_send_message_to_an_unknown_recipient_is_not_found(student, recipient):
    with pytest.raises(NotFound):
        services.send_message(student, recipient, 'hello')


def test_a_failing_channel_layer_does_not_fail_the_send(student, instructor, monkeypatch):
    def broken():
        raise ConnectionError('redis is down')
    monkeypatch.setattr(services, 'get_channel_layer', broken)

    message = services.send_message(student, instructor.id, 'still stored')

    assert f.DirectMessage.objects.filter(pk=message.pk).exists()


def test_mark_conversation_read_only_touches_incoming_messages(student, instructor):
    f.make_message(student, instructor, 'to instructor')
    f.make_message(instructor, student, 'to student')
    cid = f.DirectMessage.get_conversation_id(student, instructor)

    assert services.mark_conversation_read(instructor, cid) == 1
    assert services.mark_conversation_read(instructor, cid) == 0
    assert f.DirectMessage.objects.filter(recipient=student, is_read=False).count() == 1


def test_conversations_are_ordered_by_latest_message_and_count_unread(student, instructor, other_student):
    f.make_message(student, instructor, 'old')
    f.make_message(other_student, instructor, 'newer')
    f.make_message(instructor, other_student, 'newest')

    summaries = selectors.conversations_for(instructor)

    assert [s.other_user.id for s in summaries] == [other_student.id, student.id]
    assert [s.last_message.content for s in summaries] == ['newest', 'old']
    assert [s.unread_count for s in summaries] == [1, 1]
    assert [s.message_count for s in summaries] == [2, 1]
    assert selectors.conversations_for(f.make_student()) == []


def test_the_conversation_list_uses_a_fixed_number_of_queries(
        student, instructor, django_assert_max_num_queries):
    other = [f.make_student() for _ in range(4)]
    for user in other:
        f.make_message(user, instructor, 'hello')
        f.make_message(instructor, user, 'hi')
    f.make_message(student, instructor, 'hey')

    with django_assert_max_num_queries(3):
        summaries = selectors.conversations_for(instructor)
        # the rows are fully usable without further queries
        [(s.other_user.email, s.last_message.sender.email) for s in summaries]

    assert len(summaries) == 5


def test_participants_and_outsiders(student, instructor, other_student):
    f.make_message(student, instructor)
    cid = f.DirectMessage.get_conversation_id(student, instructor)

    assert selectors.is_participant(student, cid) is True
    assert selectors.is_participant(instructor, cid) is True
    assert selectors.is_participant(other_student, cid) is False
    assert selectors.is_participant(student, 'conv_0_0') is False
