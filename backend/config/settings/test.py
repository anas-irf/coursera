"""Settings used by the automated test-suite.

The suite runs on SQLite by default (nothing to install).  Set
``TEST_DB_ENGINE=postgres`` to run it against PostgreSQL with the usual
``DB_NAME`` / ``DB_USER`` / ``DB_PASSWORD`` / ``DB_HOST`` / ``DB_PORT``
variables, which is what CI does.
"""
import tempfile
from pathlib import Path

from decouple import config

from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE as _BASE_MIDDLEWARE

if config('TEST_DB_ENGINE', default='sqlite').lower() != 'postgres':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': str(Path(tempfile.gettempdir()) / 'coursera_dev_check.sqlite3'),
            'TEST': {
                'NAME': str(Path(tempfile.gettempdir()) / 'coursera_test.sqlite3'),
            },
        }
    }
else:
    # base.py builds the PostgreSQL connection from the DB_* variables
    from .base import DATABASES  # noqa: F401

# the in-memory limiter is shared between tests and would produce flaky 403s
MIDDLEWARE = [m for m in _BASE_MIDDLEWARE if m != 'apps.core.middleware.RateLimitMiddleware']

# uploads go to a throw-away folder, never into the real media directory
MEDIA_ROOT = tempfile.mkdtemp(prefix='coursera_test_media_')

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
DEBUG = False
