"""Reading the environment, for every settings module.

Values come from real environment variables, or from a ``.env`` file next to
``manage.py`` (a real variable always wins).  The helpers are typed, so a
setting never parses a string itself.  Defaults that only make sense on a
developer's machine live in ``dev.py`` and ``test.py``; ``prod.py`` refuses to
start without what a deployment must supply.
"""
from pathlib import Path

from decouple import AutoConfig, Csv

# backend/ - this file lives in backend/config/settings/
BASE_DIR = Path(__file__).resolve().parents[2]

# where the React app runs when nobody says otherwise (development and tests only)
LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

_config = AutoConfig(search_path=BASE_DIR)


def env_str(name, default=''):
    """The variable as a string (``default`` when it is unset)."""
    return _config(name, default=default)


def env_bool(name, default=False):
    """The variable as a bool: true / false, yes / no, on / off, 1 / 0."""
    return _config(name, default=default, cast=bool)


def env_int(name, default=0):
    """The variable as an int."""
    return _config(name, default=default, cast=int)


def env_list(name, default=''):
    """A comma separated variable as a list; ``default`` is the raw string used when it is unset."""
    return _config(name, default=default, cast=Csv())
