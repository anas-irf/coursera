"""Request throttles: one named scope each, rates from the settings (environment).

A scope's rate is ``REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope]`` (``THROTTLE_<SCOPE>``
in ``.env.example``).  Counters live in the cache, so with Redis configured every
worker shares them.  Scopes do not look at paths: ``/api/v1/...`` and the
unversioned aliases of the first release are one bucket.  The client address is
the one DRF derives from ``NUM_PROXIES``.
"""
from rest_framework.throttling import AnonRateThrottle, BaseThrottle, UserRateThrottle


def client_ip(request):
    """The client address as the throttles see it: ``REMOTE_ADDR``, or the right hop of
    ``X-Forwarded-For`` when ``NUM_PROXIES`` says that proxies sit in front of the app."""
    return BaseThrottle().get_ident(request)


class LoginThrottle(AnonRateThrottle):
    """Password guessing: by address, nobody is signed in yet."""
    scope = 'login'


class PasswordChangeThrottle(UserRateThrottle):
    """Guessing the current password of a signed-in account: the login rate, per user."""
    scope = 'login'


class SignupThrottle(AnonRateThrottle):
    """Limits sign-ups per client address."""
    scope = 'signup'


class RefreshThrottle(AnonRateThrottle):
    """Limits token refreshes per client address."""
    scope = 'refresh'


class MessageThrottle(UserRateThrottle):
    """Sending direct messages over REST (the WebSocket path is limited by the connection)."""
    scope = 'messages'


class UploadThrottle(UserRateThrottle):
    """Anything that carries a file: lecture content and assignment hand-ins."""
    scope = 'uploads'


class ProgressThrottle(UserRateThrottle):
    """The video player's heartbeat (one every ~15 s per open player)."""
    scope = 'progress'
