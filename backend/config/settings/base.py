"""
Base settings shared by every environment (see dev.py, prod.py and test.py).

Values are read from environment variables, or from a ``.env`` file placed next
to ``manage.py`` (a real environment variable always wins).

For more information on this file, see
https://docs.djangoproject.com/en/5.2/topics/settings/
"""
from pathlib import Path

from decouple import AutoConfig
from django.core.exceptions import ImproperlyConfigured

# backend/ - this file lives in backend/config/settings/
BASE_DIR = Path(__file__).resolve().parents[2]

_config = AutoConfig(search_path=BASE_DIR)


def get_env_variable(var_name, default=None):
    """Get a value from the environment / .env file or raise an exception."""
    value = _config(var_name, default=None)
    if value is not None:
        return value
    if default is not None:
        return default
    raise ImproperlyConfigured(f"Set the {var_name} environment variable")


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = get_env_variable('SECRET_KEY', 'django-insecure-development-only-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = get_env_variable('DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = get_env_variable('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

EXTERNAL_APPS = [
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

INSTALLED_APPS += EXTERNAL_APPS

MIDDLEWARE = [
    'apps.core.middleware.RateLimitMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Session Security
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True

ROOT_URLCONF = 'config.urls'

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

DB_ENGINE = get_env_variable('DB_ENGINE', 'postgres').lower()

if DB_ENGINE == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / get_env_variable('SQLITE_NAME', 'db.sqlite3'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': get_env_variable('DB_NAME', 'coursera_db'),
            'USER': get_env_variable('DB_USER', 'coursera_admin'),
            'PASSWORD': get_env_variable('DB_PASSWORD', '123'),
            'HOST': get_env_variable('DB_HOST', 'localhost'),
            'PORT': get_env_variable('DB_PORT', '5432'),
        }
    }


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

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True

# SECURITY: Never allow all origins in production
CORS_ALLOW_ALL_ORIGINS = get_env_variable('CORS_ALLOW_ALL_ORIGINS', 'False').lower() == 'true'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'EXCEPTION_HANDLER': 'apps.core.api.errors.exception_handler',
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Channels Configuration
# The in-memory layer only works inside a single process; set REDIS_URL to use
# Redis when the API and the WebSocket consumers run in different processes.
REDIS_URL = get_env_variable('REDIS_URL', '')

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

# Logging configuration for debugging WebSocket issues
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'apps.messaging.consumers': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.messaging.middleware': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
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

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY = get_env_variable('STRIPE_PUBLISHABLE_KEY', 'pk_test_51S7ZPzPntOYHMm3396WCOaEmjC0GuO1WWtzB1c8a9XnnGzRkSWpHJAfXDz8XamBuxVO9aetwPP8S2O4jddLvHEOs00PVe1uTVt')
STRIPE_SECRET_KEY = get_env_variable('STRIPE_SECRET_KEY', '')
STRIPE_ACCOUNT_ID = get_env_variable('STRIPE_ACCOUNT_ID', 'acct_1S7ZPzPntOYHMm33')
STRIPE_WEBHOOK_SECRET = get_env_variable('STRIPE_WEBHOOK_SECRET', '')

# Where Stripe sends the customer back to (the React app)
FRONTEND_URL = get_env_variable('FRONTEND_URL', 'http://localhost:3000')
