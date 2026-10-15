"""Engagement slice: direct messages over REST and over WebSockets.

The WebSocket tests drive the ASGI application of the project (looked up through
``settings.ASGI_APPLICATION`` so the module path may change) with
``channels.testing.WebsocketCommunicator``.  pytest-asyncio is not available, so
each test is a plain sync test that runs one coroutine through
``asgiref.sync.async_to_sync``; they need ``transaction=True`` because the
consumers talk to the database from other threads.
"""

import pytest
from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import channel_layers
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.utils.module_loading import import_string

import factories as f

SEND = '/api/v1/messaging/send/'
CONVERSATIONS = '/api/v1/messaging/conversations/'
USERS = '/api/v1/messaging/users/'


def conv_id(a, b):
    """The app sorts the two ids *as strings* ("10" < "9"), see the pin below."""
    first, second = sorted([str(a.id), str(b.id)])
    return f'conv_{first}_{second}'


@pytest.fixture(autouse=True)
def _classroom(request, db):
    """The people of these tests know each other: the instructor teaches a course the students take.

    (Messaging is limited to people who share a course, admins and existing conversations; the
    tests of that rule build their own surroundings and do not use this.)
    """
    names = request.fixturenames
    if 'instructor' not in names:
        return
    students = [request.getfixturevalue(name) for name in ('student', 'other_student') if name in names]
    if not students:
        return
    course = f.make_course(request.getfixturevalue('instructor'), status='published')
    for learner in students:
        f.enroll(learner, course)


@pytest.fixture(autouse=True)
def _fresh_channel_layer():
    """Every test starts (and ends) with a brand new in-memory channel layer."""
    channel_layers.backends.clear()
    yield
    channel_layers.backends.clear()


# --------------------------------------------------------------------------- #
# REST
# --------------------------------------------------------------------------- #
@pytest.mark.django_db
def test_send_message_creates_direct_message_with_conversation_id(auth_client, student, instructor):
    """REST send answers 201, stores the message and a deterministic conversation id."""
    r = auth_client(student).post(SEND, {'recipient_id': instructor.id, 'content': '  Hello there  '},
                                  format='json')

    assert r.status_code == 201
    message = r.json()['message']
    assert set(message) == {'id', 'sender', 'content', 'created_at', 'conversation_id',
                            'is_own_message'}
    assert set(message['sender']) == {'id', 'name', 'user_type'}
    assert message['is_own_message'] is True
    assert message['content'] == 'Hello there'
    assert message['conversation_id'] == conv_id(student, instructor)

    dm = f.DirectMessage.objects.get(pk=message['id'])
    assert dm.sender_id == student.id and dm.recipient_id == instructor.id
    assert dm.conversation_id == conv_id(student, instructor)
    assert dm.conversation_id.startswith('conv_')
    assert dm.is_read is False
    assert dm.content == 'Hello there'

    # the reverse direction lands in the same conversation
    r = auth_client(instructor).post(SEND, {'recipient_id': student.id, 'content': 'Hi'}, format='json')
    assert r.json()['message']['conversation_id'] == dm.conversation_id


@pytest.mark.django_db
def test_a_conversation_has_one_stable_id_per_pair_of_people(auth_client):
    """The id is what the sockets and the history are addressed with, so it must be the same whoever
    writes first, the same every time, and different for every pair (also when the ids are 9 and 10,
    where "10" sorts before "9" as a string, and 1+23 against 12+3)."""
    people = [f.make_student(id=i) for i in (1, 3, 9, 10, 12, 23)]
    course = f.make_course(f.make_instructor(), status='published')
    for person in people:
        f.enroll(person, course)

    seen = {}
    for index, a in enumerate(people):
        for b in people[index + 1:]:
            first = auth_client(a).post(SEND, {'recipient_id': b.id, 'content': 'hi'}, format='json')
            reply = auth_client(b).post(SEND, {'recipient_id': a.id, 'content': 'hello'}, format='json')
            again = auth_client(a).post(SEND, {'recipient_id': b.id, 'content': 'again'}, format='json')
            ids = {first.json()['message']['conversation_id'], reply.json()['message']['conversation_id'],
                   again.json()['message']['conversation_id']}
            assert len(ids) == 1, (a.id, b.id)                    # symmetric and stable
            seen[frozenset((a.id, b.id))] = ids.pop()

    assert len(set(seen.values())) == len(seen)                  # unique per pair


@pytest.mark.django_db
def test_send_message_validation(api, auth_client, student, instructor):
    """Missing fields 400, unknown recipient 404, anonymous 401."""
    client = auth_client(student)

    assert api.post(SEND, {'recipient_id': instructor.id, 'content': 'x'},
                    format='json').status_code == 401
    for payload in ({'content': 'x'}, {'recipient_id': instructor.id},
                    {'recipient_id': instructor.id, 'content': '   '}):
        r = client.post(SEND, payload, format='json')
        assert r.status_code == 400, payload
        assert 'error' in r.json()
    r = client.post(SEND, {'recipient_id': 999999, 'content': 'x'}, format='json')
    assert r.status_code == 404
    assert f.DirectMessage.objects.count() == 0


@pytest.mark.django_db
def test_conversations_list_with_unread_counts(auth_client, student, instructor, other_student):
    """Conversation list shape with per-user unread counts."""
    f.make_message(student, instructor, 'one')
    f.make_message(student, instructor, 'two')
    f.make_message(instructor, student, 'three')
    f.make_message(other_student, instructor, 'elsewhere')

    r = auth_client(instructor).get(CONVERSATIONS)

    assert r.status_code == 200
    rows = {row['id']: row for row in r.json()['conversations']}
    assert set(rows) == {conv_id(student, instructor), conv_id(other_student, instructor)}
    row = rows[conv_id(student, instructor)]
    assert set(row) == {'id', 'other_user', 'last_message', 'last_message_time',
                        'last_message_sender', 'unread_count', 'message_count'}
    assert set(row['other_user']) == {'id', 'first_name', 'last_name', 'name', 'email',
                                      'user_type', 'avatar'}
    assert row['other_user']['id'] == student.id
    assert row['unread_count'] == 2  # "one" and "two" are unread for the instructor
    assert row['message_count'] == 3
    assert row['last_message'] == 'three'
    assert row['last_message_sender'] == instructor.id

    mine = {r_['id']: r_ for r_ in auth_client(student).get(CONVERSATIONS).json()['conversations']}
    assert mine[conv_id(student, instructor)]['unread_count'] == 1


@pytest.mark.django_db
def test_fetching_a_conversation_marks_the_messages_read(auth_client, student, instructor, other_student):
    """Fetching a conversation marks incoming messages read; outsiders get 404."""
    f.make_message(student, instructor, 'first')
    f.make_message(instructor, student, 'second')
    cid = conv_id(student, instructor)

    r = auth_client(instructor).get(f'{CONVERSATIONS}{cid}/')

    assert r.status_code == 200
    messages = r.json()['messages']
    assert [m['content'] for m in messages] == ['first', 'second']
    assert set(messages[0]) == {'id', 'sender', 'content', 'created_at', 'is_read',
                                'is_own_message'}
    assert [m['is_own_message'] for m in messages] == [False, True]
    assert f.DirectMessage.objects.filter(conversation_id=cid, recipient=instructor,
                                          is_read=True).count() == 1
    # the student's incoming message is still unread
    assert f.DirectMessage.objects.filter(conversation_id=cid, recipient=student,
                                          is_read=False).count() == 1

    # outsiders get a 404, and so does an unknown conversation
    assert auth_client(other_student).get(f'{CONVERSATIONS}{cid}/').status_code == 404
    assert auth_client(student).get(f'{CONVERSATIONS}conv_0_0/').status_code == 404


@pytest.mark.django_db
def test_mark_read_endpoint(auth_client, student, instructor, other_student):
    """mark-read returns how many incoming messages were marked."""
    f.make_message(student, instructor, 'a')
    f.make_message(student, instructor, 'b')
    cid = conv_id(student, instructor)
    url = f'{CONVERSATIONS}{cid}/mark-read/'

    # the sender has nothing to mark, an outsider neither
    assert auth_client(student).post(url).json() == {'marked_read': 0, 'conversation_id': cid}
    assert auth_client(other_student).post(url).json()['marked_read'] == 0

    r = auth_client(instructor).post(url)
    assert r.status_code == 200
    assert r.json() == {'marked_read': 2, 'conversation_id': cid}
    assert f.DirectMessage.objects.filter(conversation_id=cid, is_read=False).count() == 0
    assert auth_client(instructor).post(url).json()['marked_read'] == 0


@pytest.mark.django_db
def test_available_users_are_the_people_one_shares_a_course_with_and_the_admins(
        auth_client, student, instructor, admin, other_student):
    """Teachers, classmates and admins: not the whole user table."""
    stranger = f.make_student()
    another_course_teacher = f.make_instructor()
    f.make_course(another_course_teacher, status='published')

    r = auth_client(student).get(USERS)

    assert r.status_code == 200
    rows = r.json()['users']
    emails = {row['email'] for row in rows}
    assert emails == {instructor.email, admin.email, other_student.email}
    assert stranger.email not in emails and another_course_teacher.email not in emails
    assert student.email not in emails
    assert set(rows[0]) == {'id', 'first_name', 'last_name', 'name', 'email', 'user_type', 'avatar'}


@pytest.mark.django_db
def test_an_instructor_sees_their_students_and_the_admins_only(
        auth_client, student, instructor, admin, other_student):
    stranger = f.make_student()
    colleague = f.make_instructor()

    emails = {row['email'] for row in auth_client(instructor).get(USERS).json()['users']}

    assert emails == {student.email, other_student.email, admin.email}
    assert stranger.email not in emails and colleague.email not in emails


@pytest.mark.django_db
def test_an_admin_may_write_to_every_active_user(auth_client, admin, student, instructor):
    gone = f.make_student()
    f.User.objects.filter(pk=gone.pk).update(is_active=False)

    emails = {row['email'] for row in auth_client(admin).get(USERS).json()['users']}

    assert {student.email, instructor.email} <= emails
    assert gone.email not in emails


@pytest.mark.django_db
def test_a_stranger_cannot_be_written_to_but_can_answer_once_written_to(auth_client, student):
    """The scope is enforced when sending, not only listed: and a reply is always possible."""
    stranger = f.make_student()

    refused = auth_client(student).post(SEND, {'recipient_id': stranger.id, 'content': 'hi'}, format='json')
    assert refused.status_code == 403
    assert refused.json() == {'error': 'You cannot message this user'}
    assert f.DirectMessage.objects.count() == 0

    f.make_message(stranger, student, 'hello, I am new here')   # they wrote first
    answered = auth_client(student).post(SEND, {'recipient_id': stranger.id, 'content': 'welcome'},
                                         format='json')
    assert answered.status_code == 201


@pytest.mark.django_db
def test_nobody_writes_to_themselves_or_to_a_deactivated_account(auth_client, student, instructor):
    client = auth_client(student)
    assert client.post(SEND, {'recipient_id': student.id, 'content': 'me'}, format='json').status_code == 400
    f.User.objects.filter(pk=instructor.pk).update(is_active=False)
    assert client.post(SEND, {'recipient_id': instructor.id, 'content': 'x'}, format='json').status_code == 403


@pytest.mark.django_db
def test_messaging_rest_requires_authentication(api):
    """All messaging REST endpoints are 401 for anonymous users."""
    for url in (SEND, CONVERSATIONS, USERS, f'{CONVERSATIONS}conv_1_2/'):
        r = api.get(url) if url != SEND else api.post(url, {}, format='json')
        assert r.status_code == 401, url


# --------------------------------------------------------------------------- #
# WebSockets
# --------------------------------------------------------------------------- #
def application():
    return import_string(settings.ASGI_APPLICATION)


def ws(path):
    return WebsocketCommunicator(application(), path)


def chat_path(conversation, user=None, token=None):
    path = f'/ws/chat/{conversation}/'
    token = token or (f.access_token_for(user) if user else None)
    return f'{path}?token={token}' if token else path


def user_path(user=None, token=None):
    token = token or (f.access_token_for(user) if user else None)
    return f'/ws/user/?token={token}' if token else '/ws/user/'


@pytest.mark.django_db(transaction=True)
def test_websocket_rejects_anonymous_and_invalid_tokens():
    """Sockets without a (valid) ?token= are closed."""
    student, instructor = f.make_student(), f.make_instructor()
    f.make_message(student, instructor)
    cid = conv_id(student, instructor)

    async def scenario():
        for path in (chat_path(cid), chat_path(cid, token='not-a-jwt'),
                     user_path(), user_path(token='not-a-jwt')):
            comm = ws(path)
            connected, _ = await comm.connect()
            assert connected is False, path
            await comm.disconnect()

    async_to_sync(scenario)()


@pytest.mark.django_db(transaction=True)
def test_chat_socket_accepts_participants_only():
    """Only the two participants may open /ws/chat/<conversation>/."""
    student, instructor, outsider = f.make_student(), f.make_instructor(), f.make_student()
    f.make_message(student, instructor)
    cid = conv_id(student, instructor)

    paths = {name: chat_path(cid, user) for name, user in
             (('student', student), ('instructor', instructor), ('outsider', outsider))}

    async def scenario():
        results = {}
        for name, path in paths.items():
            comm = ws(path)
            connected, _ = await comm.connect()
            results[name] = connected
            if connected:
                await comm.disconnect()
        return results

    results = async_to_sync(scenario)()

    assert results == {'student': True, 'instructor': True, 'outsider': False}


@pytest.mark.django_db(transaction=True)
def test_chat_socket_needs_an_existing_conversation():
    """Current behaviour: membership is derived from stored messages, so nobody
    can open a chat socket for a conversation that has no message yet."""
    student, instructor = f.make_student(), f.make_instructor()
    path = chat_path(conv_id(student, instructor), student)

    async def scenario():
        comm = ws(path)
        connected, _ = await comm.connect()
        return connected

    assert async_to_sync(scenario)() is False


@pytest.mark.django_db(transaction=True)
def test_user_socket_accepts_authenticated_user():
    """/ws/user/ accepts an authenticated user."""
    student = f.make_student()
    path = user_path(student)

    async def scenario():
        comm = ws(path)
        connected, _ = await comm.connect()
        await comm.disconnect()
        return connected

    assert async_to_sync(scenario)() is True


@pytest.mark.django_db(transaction=True)
def test_rest_send_is_pushed_to_user_and_chat_sockets(auth_client):
    """A REST send is pushed to the recipient's user socket and to both chat sockets."""
    student, instructor = f.make_student(), f.make_instructor()
    f.make_message(instructor, student, 'earlier')  # makes the conversation exist
    cid = conv_id(student, instructor)
    client = auth_client(student)
    paths = (user_path(instructor), chat_path(cid, instructor), chat_path(cid, student))

    async def scenario():
        recipient_user, recipient_chat, sender_chat = (ws(path) for path in paths)
        sockets = (recipient_user, recipient_chat, sender_chat)
        try:
            for comm in sockets:
                connected, _ = await comm.connect()
                assert connected is True

            response = await sync_to_async(client.post)(
                SEND, {'recipient_id': instructor.id, 'content': 'pushed'}, format='json')
            assert response.status_code == 201

            frames = {
                'recipient_user': await recipient_user.receive_json_from(timeout=3),
                'recipient_chat': await recipient_chat.receive_json_from(timeout=3),
                'sender_chat': await sender_chat.receive_json_from(timeout=3),
            }
            return response.json()['message'], frames
        finally:
            for comm in sockets:
                await comm.disconnect()

    message, frames = async_to_sync(scenario)()

    for frame in frames.values():
        assert frame['type'] == 'chat_message'
        assert set(frame['message']) == {'id', 'sender', 'content', 'created_at',
                                         'conversation_id', 'is_own_message'}
        assert frame['message']['id'] == message['id']
        assert frame['message']['content'] == 'pushed'
        assert frame['message']['conversation_id'] == cid
    assert frames['recipient_user']['message']['is_own_message'] is False
    assert frames['recipient_chat']['message']['is_own_message'] is False
    assert frames['sender_chat']['message']['is_own_message'] is True


@pytest.mark.django_db(transaction=True)
def test_chat_message_frame_is_persisted_and_broadcast():
    """A chat_message frame is stored, echoed on the chat socket and pushed to the recipient."""
    student, instructor = f.make_student(), f.make_instructor()
    f.make_message(instructor, student, 'earlier')
    cid = conv_id(student, instructor)
    sender_path, recipient_path = chat_path(cid, student), user_path(instructor)

    async def scenario():
        sender_chat = ws(sender_path)
        recipient_user = ws(recipient_path)
        try:
            assert (await sender_chat.connect())[0] is True
            assert (await recipient_user.connect())[0] is True

            # a frame that cannot be stored is answered with an error frame (and nothing is stored)
            await sender_chat.send_json_to({'type': 'chat_message', 'message': '   ',
                                            'recipient_id': instructor.id})
            assert (await sender_chat.receive_json_from(timeout=3))['type'] == 'error'
            await sender_chat.send_json_to({'type': 'chat_message', 'message': 'no recipient'})
            assert (await sender_chat.receive_json_from(timeout=3))['type'] == 'error'

            await sender_chat.send_json_to({'type': 'chat_message', 'message': 'hello over ws',
                                            'recipient_id': instructor.id})
            echo = await sender_chat.receive_json_from(timeout=3)
            pushed = await recipient_user.receive_json_from(timeout=3)
            return echo, pushed
        finally:
            await sender_chat.disconnect()
            await recipient_user.disconnect()

    echo, pushed = async_to_sync(scenario)()

    stored = f.DirectMessage.objects.filter(content='hello over ws')
    assert stored.count() == 1
    dm = stored.get()
    assert dm.sender_id == student.id and dm.recipient_id == instructor.id
    assert dm.conversation_id == cid
    assert f.DirectMessage.objects.count() == 2  # the earlier one + the new one

    # a socket-originated message goes through the same service as a REST one,
    # so the frames have the same shape
    for frame in (echo, pushed):
        assert frame['type'] == 'chat_message'
        assert set(frame['message']) == {'id', 'sender', 'content', 'created_at',
                                         'conversation_id', 'is_own_message'}
        assert frame['message']['id'] == dm.id
        assert frame['message']['content'] == 'hello over ws'
        assert frame['message']['sender']['id'] == student.id
        assert frame['message']['conversation_id'] == cid
    assert echo['message']['is_own_message'] is True
    assert pushed['message']['is_own_message'] is False


@pytest.mark.django_db(transaction=True)
def test_typing_frame_reaches_only_the_other_participant_and_bad_json_is_reported():
    """typing frames go to the other participant; invalid JSON is answered with an error frame."""
    student, instructor = f.make_student(), f.make_instructor()
    f.make_message(instructor, student, 'earlier')
    cid = conv_id(student, instructor)
    typist_path, watcher_path = chat_path(cid, student), chat_path(cid, instructor)

    async def scenario():
        typist = ws(typist_path)
        watcher = ws(watcher_path)
        try:
            assert (await typist.connect())[0] is True
            assert (await watcher.connect())[0] is True

            await typist.send_json_to({'type': 'typing', 'is_typing': True})
            seen = await watcher.receive_json_from(timeout=3)
            await typist.receive_nothing(timeout=0.3)  # not echoed to the typist

            await typist.send_to(text_data='this is not json')
            error = await typist.receive_json_from(timeout=3)
            return seen, error
        finally:
            await typist.disconnect()
            await watcher.disconnect()

    seen, error = async_to_sync(scenario)()

    assert seen == {'type': 'typing', 'user_id': student.id, 'is_typing': True}
    assert error == {'error': 'Invalid JSON'}


@pytest.mark.django_db(transaction=True)
def test_a_binary_frame_does_not_take_the_socket_down_and_a_refusal_is_reported():
    student, instructor, stranger = f.make_student(), f.make_instructor(), f.make_student()
    f.make_message(instructor, student, 'earlier')
    cid = conv_id(student, instructor)
    path = chat_path(cid, student)

    async def scenario():
        chat = ws(path)
        try:
            assert (await chat.connect())[0] is True

            await chat.send_to(bytes_data=b'\x00\x01binary')
            binary_answer = await chat.receive_json_from(timeout=3)

            # the socket still works: a message to someone outside the student's world is refused out loud
            await chat.send_json_to({'type': 'chat_message', 'message': 'psst', 'recipient_id': stranger.id})
            refusal = await chat.receive_json_from(timeout=3)
            return binary_answer, refusal
        finally:
            await chat.disconnect()

    binary_answer, refusal = async_to_sync(scenario)()

    assert binary_answer['type'] == 'error'
    assert refusal == {'type': 'error', 'error': 'You cannot message this user'}
    assert not f.DirectMessage.objects.filter(content='psst').exists()


@pytest.mark.django_db(transaction=True)
def test_a_deactivated_account_has_no_socket():
    student = f.make_student()
    token = f.access_token_for(student)
    f.User.objects.filter(pk=student.pk).update(is_active=False)

    async def scenario():
        application = import_string(settings.ASGI_APPLICATION)
        communicator = WebsocketCommunicator(application, f'/ws/user/?token={token}')
        connected, _ = await communicator.connect()
        await communicator.disconnect()
        return connected

    assert async_to_sync(scenario)() is False
