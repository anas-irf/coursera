"""Settings used by the automated test-suite.

The suite runs on SQLite by default (nothing to install).  Set
``TEST_DB_ENGINE=postgres`` to run it against PostgreSQL with the usual
``DB_NAME`` / ``DB_USER`` / ``DB_PASSWORD`` / ``DB_HOST`` / ``DB_PORT``
variables, which is what CI does.  Django creates (and drops) a separate
``test_<DB_NAME>`` database, so the role needs CREATEDB.
"""
import tempfile
from pathlib import Path

from .base import *  # noqa: F401,F403
from .base import INSTALLED_APPS as _BASE_APPS
from .base import MIDDLEWARE as _BASE_MIDDLEWARE
from .base import postgres_database
from .env import LOCAL_ORIGINS, env_str

if env_str('TEST_DB_ENGINE', 'sqlite').lower() != 'postgres':
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
    # PostgreSQL whatever DB_ENGINE says for the dev server (a .env on sqlite
    # must not silently turn this into a SQLite run)
    DATABASES = {'default': postgres_database()}

# the suite never reads a deployment's secrets: fixed, obviously fake values
SECRET_KEY = 'test-only-secret-key-not-used-anywhere-else'
ALLOWED_HOSTS = ['testserver', 'localhost']
CORS_ALLOWED_ORIGINS = LOCAL_ORIGINS
FRONTEND_URL = 'http://localhost:3000'

# the seeding tools are tested too, but never installed in production
INSTALLED_APPS = [*_BASE_APPS, 'apps.seeding']

# the in-memory limiter is shared between tests and would produce flaky 403s
MIDDLEWARE = [m for m in _BASE_MIDDLEWARE if m != 'apps.core.middleware.RateLimitMiddleware']

# uploads go to a throw-away folder, never into the real media directory
MEDIA_ROOT = tempfile.mkdtemp(prefix='coursera_test_media_')

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
DEBUG = False
