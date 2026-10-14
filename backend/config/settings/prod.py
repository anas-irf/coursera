"""Production settings: everything from base, plus what a deployment must supply.

``wsgi.py`` and ``asgi.py`` select this module unless ``DJANGO_SETTINGS_MODULE``
says otherwise.  Starting without a required variable raises
``ImproperlyConfigured`` naming every missing one, so a half-configured
deployment fails at boot instead of running with a development default.
"""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import CORS_ALLOW_ALL_ORIGINS, DATABASES, DB_ENGINE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
from .env import env_bool, env_str

_missing = []
_problems = []


def _need(name):
    """The variable's value; a missing one is collected and reported with the others."""
    value = env_str(name)
    if not value:
        _missing.append(name)
    return value


DEBUG = env_bool('DEBUG', False)

SECRET_KEY = _need('SECRET_KEY')
if SECRET_KEY.startswith(('django-insecure-', 'change-me')):
    _problems.append('SECRET_KEY is a placeholder (it starts with "django-insecure-" or "change-me")')

ALLOWED_HOSTS = [host.strip() for host in _need('ALLOWED_HOSTS').split(',') if host.strip()]
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _need('CORS_ALLOWED_ORIGINS').split(',') if origin.strip()]
FRONTEND_URL = _need('FRONTEND_URL')

if CORS_ALLOW_ALL_ORIGINS:
    _problems.append('CORS_ALLOW_ALL_ORIGINS must not be true in production')

if DB_ENGINE != 'sqlite' and not DATABASES['default']['PASSWORD']:
    _missing.append('DB_PASSWORD')

# the in-memory channel layer works inside one process only
if env_str('CHANNEL_LAYER') != 'memory':
    _need('REDIS_URL')

# a configured Stripe account needs its webhook secret (an empty one is refused, see billing)
if STRIPE_SECRET_KEY and not STRIPE_WEBHOOK_SECRET:
    _missing.append('STRIPE_WEBHOOK_SECRET')

if _missing or _problems:
    raise ImproperlyConfigured(
        'Production settings are incomplete. '
        + (f'Set: {", ".join(_missing)}. ' if _missing else '')
        + (f'Fix: {"; ".join(_problems)}.' if _problems else '')
    )

# HTTPS only.  Behind a TLS terminating proxy set BEHIND_TLS_PROXY so the
# proxy's X-Forwarded-Proto header is trusted (never set it without a proxy).
SECURE_SSL_REDIRECT = True
if env_bool('BEHIND_TLS_PROXY', False):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
