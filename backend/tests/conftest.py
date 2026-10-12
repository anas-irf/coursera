"""Shared fixtures for the characterization suite.

Rules this suite follows (so it can verify a refactor, see tests/factories.py):
* literal URL strings only - no ``reverse()``, url names or app namespaces;
* models are only imported in ``factories.py``;
* Stripe is only patched at library level (``stripe.checkout.Session.create`` ...);
* nothing here imports application views / services.
"""
import atexit
import shutil
import tempfile
from pathlib import Path

import pytest
from django.conf import settings
from rest_framework.test import APIClient

import factories as f


def pytest_configure(config):
    config.addinivalue_line(
        'markers', 'pinned_bug: asserts a known "current behaviour (bug)" of the application; '
                   'expected to be flipped or deleted when the bug is fixed (pytest -m pinned_bug)')
    config.addinivalue_line(
        'markers', 'removed_in_s1a: documents an endpoint that refactor step S1a deletes '
                   '(pytest -m removed_in_s1a)')


def _remove_throwaway_media_root():
    """Delete the per-process temp MEDIA_ROOT - and only a temp MEDIA_ROOT."""
    media_root = Path(settings.MEDIA_ROOT).resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    if temp_root in media_root.parents and media_root.name.startswith('coursera_test_media_'):
        shutil.rmtree(media_root, ignore_errors=True)


atexit.register(_remove_throwaway_media_root)


@pytest.fixture(scope='session', autouse=True)
def _media_root_is_a_throwaway_directory():
    """Uploads must never land in the real ``media/`` folder of the repository."""
    from django.core.files.storage import default_storage

    media_root = Path(settings.MEDIA_ROOT).resolve()
    base_dir = Path(settings.BASE_DIR).resolve()
    real_media_dirs = {base_dir / 'media', base_dir.parent / 'media'}

    assert media_root not in real_media_dirs, (
        f'MEDIA_ROOT points at the real media directory: {media_root}')
    temp_root = Path(tempfile.gettempdir()).resolve()
    assert temp_root in media_root.parents, (
        f'MEDIA_ROOT must live under the temp dir ({temp_root}), got {media_root}')
    assert Path(default_storage.location).resolve() == media_root


@pytest.fixture(scope='session', autouse=True)
def _stripe_never_uses_the_configured_key():
    """All Stripe traffic is mocked; make sure an un-mocked call could never use
    the (committed) Stripe test key of the settings."""
    import stripe
    from django.urls import get_resolver

    list(get_resolver().url_patterns)  # import the URLconf now: the payment views set the key on import
    original = stripe.api_key
    stripe.api_key = 'sk_test_disabled_by_the_test_suite'
    yield
    stripe.api_key = original


# --------------------------------------------------------------------------- #
# API clients
# --------------------------------------------------------------------------- #
@pytest.fixture
def api():
    """Anonymous API client."""
    return APIClient()


@pytest.fixture
def auth_client():
    """Factory: ``auth_client(user)`` -> APIClient authenticated as ``user``.

    ``raise_exceptions=False`` builds a client that returns the 500 response
    instead of re-raising (used for endpoints that crash today).
    """
    def make(user=None, *, raise_exceptions=True):
        client = APIClient(raise_request_exception=raise_exceptions)
        if user is not None:
            client.force_authenticate(user=user)
        return client
    return make


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
@pytest.fixture
def student(db):
    return f.make_student()


@pytest.fixture
def other_student(db):
    return f.make_student()


@pytest.fixture
def instructor(db):
    return f.make_instructor()


@pytest.fixture
def other_instructor(db):
    return f.make_instructor()


@pytest.fixture
def admin(db):
    return f.make_admin()


@pytest.fixture
def student_api(auth_client, student):
    return auth_client(student)


@pytest.fixture
def instructor_api(auth_client, instructor):
    return auth_client(instructor)


@pytest.fixture
def admin_api(auth_client, admin):
    return auth_client(admin)


# --------------------------------------------------------------------------- #
# Course fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture
def course_bundle(instructor):
    """Published free course: video + reading + quiz(40) + assignment(60)."""
    return f.build_course(instructor, status='published')


@pytest.fixture
def draft_bundle(instructor):
    """Same content as ``course_bundle`` but still a draft."""
    return f.build_course(instructor, status='draft')
