"""Production settings: everything from base, but secure by default.

Select with DJANGO_SETTINGS_MODULE=config.settings.prod
"""
from .base import *  # noqa: F401,F403
from .base import get_env_variable

DEBUG = get_env_variable('DEBUG', 'False').lower() == 'true'

SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
