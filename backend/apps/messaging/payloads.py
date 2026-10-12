"""Wire format of a direct message: one place for REST bodies and socket frames."""


def display_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.email


def avatar_url(user):
    return f"https://ui-avatars.com/api/?name={user.first_name}+{user.last_name}&background=4F46E5&color=fff"


def person(user):
    """A user as listed in the directory and in conversation rows."""
    return {
        'id': user.id,
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'name': display_name(user),
        'email': user.email,
        'user_type': user.user_type,
        'avatar': avatar_url(user),
    }


def sender(user):
    return {'id': user.id, 'name': display_name(user), 'user_type': user.user_type}


def pushed_message(message):
    """A message as answered by the send endpoint and pushed to sockets.

    It does not say who is looking at it: ``is_own_message`` is added per
    recipient (the REST view and the consumers know the viewer).
    """
    return {
        'id': message.id,
        'sender': sender(message.sender),
        'content': message.content,
        'created_at': message.created_at.isoformat(),
        'conversation_id': message.conversation_id,
    }


def history_message(message, viewer):
    """A message inside the conversation history of ``viewer``."""
    return {
        'id': message.id,
        'sender': sender(message.sender),
        'content': message.content,
        'created_at': message.created_at,
        'is_read': message.is_read,
        'is_own_message': message.sender_id == viewer.id,
    }
