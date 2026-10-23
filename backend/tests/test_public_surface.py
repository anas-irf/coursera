"""Who may call what is explicit: the routes open to anonymous callers are exactly these.

DRF's default permission is ``IsAuthenticated`` (config/settings/base.py), so a view
that forgets to declare its permissions is closed rather than public.  Opening a route
to everybody is a decision that has to change this list in the same pull request.
"""
from django.urls import URLResolver, get_resolver
from rest_framework.permissions import AllowAny

PUBLIC = {
    'api/payments/stripe/webhook/',     # Stripe calls it; the payload is verified by its signature
    'api/v1/auth/login/',
    'api/v1/auth/signup/',
    'api/v1/auth/logout/',              # the refresh token is the credential, so an expired access token still signs out
    'api/v1/auth/token/refresh/',       # the refresh token is the credential
    'api/v1/auth/demo/',                # which demo accounts the login page offers (none unless DEMO_MODE)
    'api/v1/auth/demo/login/',          # the one-click demo sign-in; a 404 unless DEMO_MODE
    'api/v1/learning/courses/',         # the public catalogue
    'api/v1/certificates/verify/<str:code>/',   # the page a certificate links to; the code is the credential
}


def _routes(patterns, prefix=''):
    for entry in patterns:
        text = prefix + str(entry.pattern)
        if isinstance(entry, URLResolver):
            if entry.namespace != 'legacy':  # the aliases are the same views
                yield from _routes(entry.url_patterns, text)
        else:
            yield text, entry.callback


def _is_public(callback):
    view_class = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    classes = list(getattr(view_class, 'permission_classes', []))
    return not classes or any(issubclass(cls, AllowAny) for cls in classes)


def test_only_the_documented_routes_are_open_to_anonymous_callers():
    public = {text for text, callback in _routes(get_resolver().url_patterns) if _is_public(callback)}

    assert public == PUBLIC


def test_the_default_permission_is_authenticated(settings):
    assert settings.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] == ('rest_framework.permissions.IsAuthenticated',)


def test_the_router_root_of_the_courses_slice_is_closed(api):
    """It used to answer an anonymous caller, because it relied on the old default."""
    assert api.get('/api/v1/courses/').status_code == 401
