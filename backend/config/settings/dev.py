"""Local development settings."""
from .base import *  # noqa: F401,F403
from .base import INSTALLED_APPS

# daphne first, so ``manage.py runserver`` serves HTTP *and* WebSockets (ASGI);
# the seeding tools (seed_demo, seed_dev, create_dev_database) exist only here
INSTALLED_APPS = ['daphne', *INSTALLED_APPS, 'apps.seeding']
