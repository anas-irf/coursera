"""Local development settings: the throw-away defaults a developer's machine needs."""
from .base import *  # noqa: F401,F403
from .base import ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, FRONTEND_URL, INSTALLED_APPS, SECRET_KEY
from .env import LOCAL_ORIGINS, env_bool

DEBUG = env_bool('DEBUG', True)

# nothing here is a secret: a real SECRET_KEY, hosts or origins in the environment win
SECRET_KEY = SECRET_KEY or 'django-insecure-development-only-key'
ALLOWED_HOSTS = ALLOWED_HOSTS or ['localhost', '127.0.0.1']
CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS or LOCAL_ORIGINS
FRONTEND_URL = FRONTEND_URL or 'http://localhost:3000'

# daphne first, so ``manage.py runserver`` serves HTTP *and* WebSockets (ASGI);
# the seeding tools (seed_demo, seed_dev, create_dev_database) exist only here
INSTALLED_APPS = ['daphne', *INSTALLED_APPS, 'apps.seeding']
