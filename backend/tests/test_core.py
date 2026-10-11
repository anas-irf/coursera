"""Cross-cutting helpers: the API error handler and the search sanitizer."""
import pytest
from rest_framework.exceptions import NotAuthenticated, ValidationError
from rest_framework.test import APIRequestFactory

from apps.core.api.errors import NotFound, PermissionDenied, ServiceError, exception_handler
from apps.core.utils import sanitize_search_query


def _handle(exc):
    request = APIRequestFactory().get('/')
    return exception_handler(exc, {'view': None, 'request': request})


def test_service_error_becomes_an_error_payload():
    response = _handle(ServiceError('Course must have at least one section'))

    assert response.status_code == 400
    assert response.data == {'error': 'Course must have at least one section'}


def test_service_error_keeps_extra_fields_and_custom_status():
    response = _handle(ServiceError('Plus required', status_code=402, requires_subscription=True))

    assert response.status_code == 402
    assert response.data == {'error': 'Plus required', 'requires_subscription': True}


def test_not_found_and_permission_denied_statuses():
    assert _handle(NotFound('nope')).status_code == 404
    assert _handle(PermissionDenied('no')).status_code == 403


def test_other_api_exceptions_are_left_to_drf():
    """The handler must not change the shape of DRF's own errors."""
    validation = _handle(ValidationError({'email': ['This field is required.']}))
    assert validation.status_code == 400
    assert validation.data == {'email': ['This field is required.']}

    assert _handle(NotAuthenticated()).status_code in (401, 403)


def test_unexpected_exceptions_are_not_swallowed():
    assert _handle(RuntimeError('boom')) is None


@pytest.mark.parametrize('raw,expected', [
    (None, ''),
    ('', ''),
    ('  python  ', 'python'),
    ('rock & roll', 'rock  roll'),
    ('DROP table', 'table'),
    ('a/*b*/c', 'abc'),
    ('x' * 150, 'x' * 100),
])
def test_sanitize_search_query(raw, expected):
    assert sanitize_search_query(raw) == expected
