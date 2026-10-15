"""Authentication of API requests: a bearer token, or the access cookie of a browser.

A cookie is sent by the browser on every request to the API, including requests a hostile page
makes on the user's behalf.  Reading data is harmless (the browser does not let that page see the
answer), but a request that **changes** something must prove it comes from our own front end:

* it carries ``X-Requested-With`` (a header a cross-site form cannot add, and a cross-origin
  script cannot add without the preflight we refuse), and
* its ``Origin`` is one of ``CORS_ALLOWED_ORIGINS``.

A bearer header is a credential the page had to know, so it needs neither.
"""
from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def origin_allowed(origin):
    """Whether ``origin`` ("https://app.example.com") may act on behalf of a cookie session."""
    if settings.CORS_ALLOW_ALL_ORIGINS:
        return True
    return bool(origin) and origin in settings.CORS_ALLOWED_ORIGINS


def require_same_site_origin(request):
    """Refuse a request that changes data unless it comes from our own front end."""
    if request.method in SAFE_METHODS:
        return
    if not request.META.get('HTTP_X_REQUESTED_WITH'):
        raise exceptions.PermissionDenied('A request that changes data must send X-Requested-With')
    if not origin_allowed(request.META.get('HTTP_ORIGIN')):
        raise exceptions.PermissionDenied('This origin may not act for the signed-in user')


class CookieJWTAuthentication(JWTAuthentication):
    """``JWTAuthentication`` that falls back to the access token cookie."""

    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not raw_token:
            return None

        validated = self.get_validated_token(raw_token)
        user = self.get_user(validated)
        require_same_site_origin(request)
        return user, validated


class Unauthenticated(BaseAuthentication):
    """For the endpoints that are the way *into* a session: login, signup, refresh and logout.

    Whatever a stale cookie or an expired header carries must not get in the way of the call that
    replaces it, so these endpoints authenticate nobody (the refresh and logout views read their
    own credential).  It still names the scheme, so a rejected credential is a 401 and not a 403.
    """

    def authenticate(self, request):
        return None

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
