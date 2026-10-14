"""Request throttles: one named scope each, rates from the settings (environment).

A scope's rate is ``REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'][scope]`` (``THROTTLE_<SCOPE>``
in ``.env.example``).  Counters live in the cache, so with Redis configured every
worker shares them.  Scopes do not look at paths: ``/api/v1/...`` and the
unversioned aliases of the first release are one bucket.  The client address is
the one DRF derives from ``NUM_PROXIES``.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    """Password guessing: by address, nobody is signed in yet."""
    scope = 'login'


class SignupThrottle(AnonRateThrottle):
    scope = 'signup'


class RefreshThrottle(AnonRateThrottle):
    scope = 'refresh'


class MessageThrottle(UserRateThrottle):
    """Sending direct messages over REST (the WebSocket path is limited by the connection)."""
    scope = 'messages'


class UploadThrottle(UserRateThrottle):
    """Anything that carries a file: lecture content and assignment hand-ins."""
    scope = 'uploads'
