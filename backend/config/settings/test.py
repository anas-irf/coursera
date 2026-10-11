"""Settings used by the automated test-suite (SQLite, temp media, no rate limiting)."""
import tempfile
from pathlib import Path

from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE as _BASE_MIDDLEWARE

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(Path(tempfile.gettempdir()) / 'coursera_dev_check.sqlite3'),
        'TEST': {
            'NAME': str(Path(tempfile.gettempdir()) / 'coursera_test.sqlite3'),
        },
    }
}

# the in-memory limiter is shared between tests and would produce flaky 403s
MIDDLEWARE = [m for m in _BASE_MIDDLEWARE if m != 'apps.core.middleware.RateLimitMiddleware']

# uploads go to a throw-away folder, never into the real media directory
MEDIA_ROOT = tempfile.mkdtemp(prefix='coursera_test_media_')

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
DEBUG = False
