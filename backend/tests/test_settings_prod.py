"""The production settings refuse to start unconfigured and switch on HTTPS-only behaviour.

``config.settings.prod`` is imported in a subprocess on a *copy* of the settings
package in a temporary folder, with a minimal environment: no ``.env`` of the
developer and nothing of the test run can leak into the result.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

CONFIG = Path(__file__).resolve().parents[1] / 'config'

# the smallest environment a deployment must provide
VALID = {
    'SECRET_KEY': 'k' * 60,
    'ALLOWED_HOSTS': 'api.example.com, www.example.com',
    'CORS_ALLOWED_ORIGINS': 'https://app.example.com',
    'FRONTEND_URL': 'https://app.example.com',
    'DB_PASSWORD': 'a-database-password',
    'REDIS_URL': 'redis://cache.example.com:6379/0',
}

PROBE = """
import json, sys
from django.core.exceptions import ImproperlyConfigured
try:
    module = __import__(sys.argv[1], fromlist=['x'])
except ImproperlyConfigured as error:
    print(json.dumps({'error': str(error)}))
    sys.exit(0)
names = ['DEBUG', 'SECRET_KEY', 'ALLOWED_HOSTS', 'CORS_ALLOWED_ORIGINS', 'FRONTEND_URL',
         'SECURE_SSL_REDIRECT', 'SECURE_PROXY_SSL_HEADER', 'SECURE_HSTS_SECONDS',
         'SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE', 'AUTH_COOKIE_SECURE',
         'DEMO_MODE', 'SERVE_MEDIA', 'INSTALLED_APPS']
print(json.dumps({name: getattr(module, name, None) for name in names}))
"""


@pytest.fixture(scope='module')
def package(tmp_path_factory):
    """A copy of backend/config, so settings/env.py looks for a .env in an empty folder."""
    root = tmp_path_factory.mktemp('settings_copy')
    shutil.copytree(CONFIG, root / 'config', ignore=shutil.ignore_patterns('__pycache__'))
    return root


def load(package, module='config.settings.prod', **env):
    """Import ``module`` with exactly ``env`` as the environment; the result dict or ``{'error': ...}``."""
    environment = {key: os.environ[key] for key in ('PATH', 'SYSTEMROOT', 'TEMP', 'TMP') if key in os.environ}
    environment.update({'PYTHONPATH': str(package), 'PYTHONIOENCODING': 'utf-8', **env})
    result = subprocess.run(  # noqa: S603  (our own interpreter and constants)
        [sys.executable, '-c', PROBE, module], cwd=package, env=environment,
        capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_production_refuses_to_start_without_its_variables_and_names_them_all(package):
    outcome = load(package)

    for name in VALID:
        assert name in outcome['error']


@pytest.mark.parametrize('overrides,fragment', [
    ({'SECRET_KEY': 'django-insecure-development-only-key'}, 'SECRET_KEY is a placeholder'),
    ({'SECRET_KEY': 'change-me-to-a-long-random-string'}, 'SECRET_KEY is a placeholder'),
    ({'CORS_ALLOW_ALL_ORIGINS': 'True'}, 'CORS_ALLOW_ALL_ORIGINS must not be true'),
    ({'STRIPE_SECRET_KEY': 'sk_test_x'}, 'STRIPE_WEBHOOK_SECRET'),
])
def test_production_refuses_unsafe_values(package, overrides, fragment):
    outcome = load(package, **{**VALID, **overrides})

    assert fragment in outcome['error']


def test_a_complete_environment_gives_https_only_settings(package):
    settings = load(package, **VALID)

    assert settings['DEBUG'] is False
    assert settings['SECRET_KEY'] == VALID['SECRET_KEY']
    assert settings['ALLOWED_HOSTS'] == ['api.example.com', 'www.example.com']
    assert settings['CORS_ALLOWED_ORIGINS'] == ['https://app.example.com']
    assert settings['SECURE_SSL_REDIRECT'] is True
    assert settings['SESSION_COOKIE_SECURE'] is True
    assert settings['CSRF_COOKIE_SECURE'] is True
    assert settings['AUTH_COOKIE_SECURE'] is True    # the session cookies of the browser
    assert settings['SECURE_HSTS_SECONDS'] == 31536000
    assert settings['SECURE_PROXY_SSL_HEADER'] is None


def test_the_proxy_header_is_trusted_only_when_asked_for(package):
    settings = load(package, **VALID, BEHIND_TLS_PROXY='True')

    assert settings['SECURE_PROXY_SSL_HEADER'] == ['HTTP_X_FORWARDED_PROTO', 'https']


def test_a_single_process_deployment_may_use_the_memory_layer_and_sqlite(package):
    env = {key: value for key, value in VALID.items() if key not in ('REDIS_URL', 'DB_PASSWORD')}

    settings = load(package, **env, CHANNEL_LAYER='memory', DB_ENGINE='sqlite')

    assert 'error' not in settings


def test_the_web_entry_points_default_to_production():
    for name in ('wsgi.py', 'asgi.py'):
        source = (CONFIG / name).read_text(encoding='utf-8')

        assert "'DJANGO_SETTINGS_MODULE', 'config.settings.prod'" in source


def test_development_needs_no_configuration(package):
    settings = load(package, module='config.settings.dev')

    assert settings['DEBUG'] is True
    assert settings['SECRET_KEY'].startswith('django-insecure-')
    assert settings['ALLOWED_HOSTS'] == ['localhost', '127.0.0.1']
    assert 'http://localhost:3000' in settings['CORS_ALLOWED_ORIGINS']
    assert settings['SESSION_COOKIE_SECURE'] is None  # Django's own default: off


def test_production_is_no_demo_unless_asked_and_then_can_be_seeded(package):
    plain = load(package, **VALID)

    assert plain['DEMO_MODE'] is False and plain['SERVE_MEDIA'] is False
    assert 'apps.seeding' not in plain['INSTALLED_APPS']

    demo = load(package, **VALID, DEMO_MODE='True', SERVE_MEDIA='True')

    assert demo['DEMO_MODE'] is True and demo['SERVE_MEDIA'] is True
    assert demo['INSTALLED_APPS'][-1] == 'apps.seeding'
    assert demo['SECURE_SSL_REDIRECT'] is True            # a demo is still served over HTTPS only


def test_development_runs_as_a_demo_unless_told_otherwise(package):
    assert load(package, module='config.settings.dev')['DEMO_MODE'] is True
    assert load(package, module='config.settings.dev', DEMO_MODE='False')['DEMO_MODE'] is False
