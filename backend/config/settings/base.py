"""
Base settings shared by every environment (``dev.py``, ``prod.py`` and ``test.py`` extend it).

Nothing in here is a development convenience: what only makes sense on a
developer's machine (the throw-away secret key, localhost origins, DEBUG on) is
set in ``dev.py`` and ``test.py``, and ``prod.py`` refuses to start without the
values a deployment must supply.  Every variable is documented in
``backend/.env.example``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/topics/settings/
"""
from datetime import timedelta

from .env import BASE_DIR, env_bool, env_int, env_list, env_str

SECRET_KEY = env_str('SECRET_KEY')

# secure by default: dev.py switches it on locally, prod.py reads the variable
DEBUG = False

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS')


# Application definition

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'rest_framework_simplejwt.token_blacklist',
    'channels',  # WebSocket support

    # One app per product slice. Packages were renamed to slice names; the
    # AppConfig labels (accounts, courses, enrollments, payments, discussions,
    # analytics, ...) are unchanged, so tables and migrations are untouched.
    'apps.accounts',
    'apps.courses',
    'apps.learning',
    'apps.assessments',
    'apps.certificates',
    'apps.billing',
    'apps.messaging',
    'apps.notifications',
    'apps.insights',
    'apps.content',
    'apps.core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.SecurityMiddleware',
    'apps.core.middleware.LegacyApiMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Security headers and cookies (prod.py adds HTTPS-only behaviour)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True

ROOT_URLCONF = 'config.urls'

# The API lives at /api/v1/<slice>/.  The unversioned /api/<slice>/ paths of the
# first release stay as deprecated aliases until this is switched off; the
# sunset is an HTTP date (e.g. "Wed, 31 Dec 2026 23:59:59 GMT") sent to clients.
API_LEGACY_ALIASES = env_bool('API_LEGACY_ALIASES', True)
API_LEGACY_SUNSET = env_str('API_LEGACY_SUNSET')

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
# DB_ENGINE=sqlite gives a zero-setup local database (used by the quickstart
# and the test-suite); the default stays PostgreSQL.

DB_ENGINE = env_str('DB_ENGINE', 'postgres').lower()


def postgres_database():
    """The PostgreSQL connection described by the DB_* variables.

    There is no built-in password: an unset ``DB_PASSWORD`` stays empty, the
    connection is refused and ``manage.py create_dev_database`` will not create
    a role without one.
    """
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env_str('DB_NAME', 'coursera_db'),
        'USER': env_str('DB_USER', 'coursera_admin'),
        'PASSWORD': env_str('DB_PASSWORD', ''),
        'HOST': env_str('DB_HOST', 'localhost'),
        'PORT': env_str('DB_PORT', '5432'),
    }


if DB_ENGINE == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / env_str('SQLITE_NAME', 'db.sqlite3'),
        }
    }
else:
    DATABASES = {'default': postgres_database()}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Cross-origin access: the origins of the React app.  There is no built-in
# list; dev.py and test.py default to localhost, prod.py requires the variable.
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')

CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['X-Total-Count', 'Link']  # the paging headers (apps.core.api.pagination)

# SECURITY: never allow all origins in production (prod.py refuses it)
CORS_ALLOW_ALL_ORIGINS = env_bool('CORS_ALLOW_ALL_ORIGINS', False)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # secure by default: a view that forgets to say who may call it is closed, not public
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # named scopes (apps.core.api.throttling); every other view is limited per address or user
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': env_str('THROTTLE_ANON', '120/min'),
        'user': env_str('THROTTLE_USER', '1200/min'),
        'login': env_str('THROTTLE_LOGIN', '10/min'),
        'signup': env_str('THROTTLE_SIGNUP', '10/hour'),
        'refresh': env_str('THROTTLE_REFRESH', '60/min'),
        'messages': env_str('THROTTLE_MESSAGES', '60/min'),
        'uploads': env_str('THROTTLE_UPLOADS', '30/min'),
        'progress': env_str('THROTTLE_PROGRESS', '120/min'),
    },
    # how many proxies sit in front of the app: the client address is the right
    # X-Forwarded-For hop (0 = REMOTE_ADDR; never trust a header nobody appended)
    'NUM_PROXIES': env_int('NUM_PROXIES', 0),
    'EXCEPTION_HANDLER': 'apps.core.api.errors.exception_handler',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env_int('JWT_ACCESS_LIFETIME_MINUTES', 60)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env_int('JWT_REFRESH_LIFETIME_DAYS', 7)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Channels Configuration
# The in-memory layer only works inside a single process; set REDIS_URL to use
# Redis when the API and the WebSocket consumers run in different processes.
REDIS_URL = env_str('REDIS_URL')

if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [REDIS_URL]},
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
            'CONFIG': {
                'capacity': 1500,  # Maximum number of messages to store
                'expiry': 60,      # Messages expire after 60 seconds
            },
        },
    }

# Throttle counters (and anything else cached) live in Redis when there is one, so every
# worker shares them; otherwise each process keeps its own.
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        },
    }

# Logging: everything goes to the console (the platform collects stdout).  The
# application's own loggers (``apps.*``) follow LOG_LEVEL; uncaught exceptions
# of a request are logged by ``django.request`` whatever DEBUG says.
LOG_LEVEL = env_str('LOG_LEVEL', 'INFO').upper()

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'plain': {'format': '%(asctime)s %(levelname)s %(name)s: %(message)s'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'plain'},
    },
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {
        'apps': {'handlers': ['console'], 'level': LOG_LEVEL, 'propagate': False},
        'django.request': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.security': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}

AUTH_USER_MODEL = 'accounts.User'

# Media files (uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# File upload settings - Allow up to 2GB uploads
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB - files larger than this go to temp disk storage
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB - max size for POST data in memory
FILE_UPLOAD_PERMISSIONS = 0o644
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o755

# Max upload size is handled by web server (nginx/apache) and not Django directly
# For development, ensure your web server allows 2GB+ uploads

# Stripe: the secret key and the webhook secret have no default
STRIPE_SECRET_KEY = env_str('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = env_str('STRIPE_WEBHOOK_SECRET')

# Where Stripe sends the customer back to (the React app)
FRONTEND_URL = env_str('FRONTEND_URL')

# A quiz answer may arrive this long after the time limit (network, clock skew) before the
# attempt is closed at zero.
QUIZ_SUBMIT_GRACE_SECONDS = env_int('QUIZ_SUBMIT_GRACE_SECONDS', 30)

# The weighted course grade (percent) a student needs for a pass: it decides the certificate
# and the "passing" flags of the gradebooks.
COURSE_PASSING_GRADE = env_int('COURSE_PASSING_GRADE', 60)

# Password of the users created by ``manage.py seed_dev`` (random, printed once, when empty)
SEED_PASSWORD = env_str('SEED_PASSWORD')
