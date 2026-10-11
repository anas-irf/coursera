"""Settings used by the automated test-suite (SQLite, temp media, no rate limiting)."""
import tempfile
from pathlib import Path

from .settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(Path(tempfile.gettempdir()) / 'coursera_dev_check.sqlite3'),
        'TEST': {
            'NAME': str(Path(tempfile.gettempdir()) / 'coursera_test.sqlite3'),
        },
    }
}

# the search app relies on Postgres-only fields and has no live code
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'search']

# the in-memory limiter is shared between tests and would produce flaky 403s
MIDDLEWARE = [m for m in MIDDLEWARE if m != 'core.security.RateLimitMiddleware']

# uploads go to a throw-away folder, never into the real media directory
MEDIA_ROOT = tempfile.mkdtemp(prefix='coursera_test_media_')

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
DEBUG = False
