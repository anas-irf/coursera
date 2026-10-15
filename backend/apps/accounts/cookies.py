"""The session cookies: where the JWT pair lives for a browser.

The access token goes in ``AUTH_COOKIE_ACCESS`` (path ``/``, it must reach the WebSocket) and the
refresh token in ``AUTH_COOKIE_REFRESH`` (path ``/api/``: only the auth endpoints need it).  Both
are ``HttpOnly``, so a script on the page, an XSS included, cannot read them.  ``Secure``,
``SameSite`` and ``Domain`` come from the settings (``AUTH_COOKIE_*``).

Non-browser clients (scripts, mobile apps) keep using ``Authorization: Bearer``; the tokens are in
the response body for them while ``AUTH_LEGACY_TOKEN_TRANSPORT`` is on or the request says
``X-Auth-Transport: bearer``.
"""
from django.conf import settings


def bearer_transport(request):
    """Whether this caller gets the tokens in the body (and may send the refresh token in one)."""
    return settings.AUTH_LEGACY_TOKEN_TRANSPORT or request.headers.get('X-Auth-Transport') == 'bearer'


def _options():
    return {
        'httponly': True,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'domain': settings.AUTH_COOKIE_DOMAIN,
    }


def set_auth_cookies(response, tokens):
    """Put the access and refresh token in their cookies; they live as long as the tokens do."""
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS, tokens['access'],
        max_age=int(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds()), path='/', **_options())
    if tokens.get('refresh'):
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH, tokens['refresh'],
            max_age=int(jwt['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            path=settings.AUTH_COOKIE_REFRESH_PATH, **_options())
    return response


def clear_auth_cookies(response):
    """Expire both cookies (the path and domain must match the ones they were set with)."""
    domain, samesite = settings.AUTH_COOKIE_DOMAIN, settings.AUTH_COOKIE_SAMESITE
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path='/', domain=domain, samesite=samesite)
    response.delete_cookie(
        settings.AUTH_COOKIE_REFRESH, path=settings.AUTH_COOKIE_REFRESH_PATH, domain=domain, samesite=samesite)
    return response


def explicit_refresh_token(request):
    """The refresh token the caller put in the body (bearer transport only), else ``None``."""
    if bearer_transport(request) and hasattr(request.data, 'get'):
        value = request.data.get('refresh')
        if isinstance(value, str) and value:
            return value
    return None
