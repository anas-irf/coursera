"""Who is on the other end of a WebSocket: the session cookie (or a legacy token)."""

import logging
from http.cookies import CookieError, SimpleCookie
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.authentication import origin_allowed

User = get_user_model()
logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_string):
    """The active user a JWT access token belongs to, else ``AnonymousUser``."""
    try:
        token = AccessToken(token_string)
        user = User.objects.get(id=token['user_id'], is_active=True)
        logger.info('WebSocket authentication successful for user id=%s', user.pk)
        return user
    except (InvalidToken, TokenError, User.DoesNotExist) as error:
        logger.warning('WebSocket authentication failed: %s', error)
        return AnonymousUser()


def _header(scope, name):
    for key, value in scope.get('headers', []):
        if key == name:
            return value.decode('latin-1')
    return None


def _cookie_token(scope):
    """The access token cookie of the handshake, if the page that opened the socket is ours.

    A browser sends the cookie to the socket whatever page opened it, so the ``Origin`` of the
    handshake has to be one of the app's (a page of another site must not get a socket as the user).
    """
    raw = _header(scope, b'cookie')
    if not raw:
        return None
    try:
        cookie = SimpleCookie(raw)
    except CookieError:
        return None
    morsel = cookie.get(settings.AUTH_COOKIE_ACCESS)
    if morsel is None:
        return None

    origin = _header(scope, b'origin')
    if not origin_allowed(origin):
        logger.warning('WebSocket with a session cookie from origin %s refused', origin)
        return None
    return morsel.value


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticates a WebSocket from the access token cookie (or, while the release before
    cookies is still around, from ``?token=``)."""

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket':
            token = None
            if settings.AUTH_LEGACY_TOKEN_TRANSPORT:
                query = parse_qs(scope.get('query_string', b'').decode('utf-8'))
                token = query.get('token', [None])[0]
            token = token or _cookie_token(scope)

            if token:
                scope['user'] = await get_user_from_token(token)
            else:
                logger.warning('No credentials found in the WebSocket handshake')
                scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Stack JWT auth middleware with other middlewares"""
    return JWTAuthMiddleware(inner)
