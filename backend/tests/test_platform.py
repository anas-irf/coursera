"""Platform behaviour shared by every endpoint: security headers, CORS and the
shape of authentication failures.

(Throttling is covered by test_throttling: the suite settings make every scope
practically unlimited because thousands of calls come from one address.)
"""
import pytest


pytestmark = pytest.mark.django_db

DEV_ORIGIN = 'http://localhost:3000'


def test_security_headers_are_added_to_api_responses(api):
    """The security middleware adds CSP / nosniff / frame / referrer headers."""
    r = api.get('/api/v1/learning/courses/')

    assert r.status_code == 200
    assert r['X-Content-Type-Options'] == 'nosniff'
    assert r['X-Frame-Options'] == 'DENY'
    assert r['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert r['X-XSS-Protection']
    csp = r['Content-Security-Policy']
    assert "default-src 'self'" in csp

    # error responses carry them as well
    r = api.get('/api/v1/auth/profile/')
    assert r.status_code == 401
    assert r['X-Content-Type-Options'] == 'nosniff'


def test_gradebook_paths_are_never_cached(auth_client, student):
    """Gradebook responses are marked no-store."""
    r = auth_client(student).get('/api/v1/assessments/student/gradebook/')

    assert r.status_code == 200
    assert 'no-store' in r['Cache-Control']
    assert r['Pragma'] == 'no-cache'


def test_cors_allows_the_development_frontend_origin(api):
    """localhost:3000 is allowed (with credentials); other origins are not."""
    r = api.get('/api/v1/learning/courses/', HTTP_ORIGIN=DEV_ORIGIN)

    assert r['Access-Control-Allow-Origin'] == DEV_ORIGIN
    assert r['Access-Control-Allow-Credentials'] == 'true'

    r = api.get('/api/v1/learning/courses/', HTTP_ORIGIN='https://evil.example')
    assert 'Access-Control-Allow-Origin' not in r


def test_cors_preflight_for_an_authenticated_json_request(api):
    """CORS preflight allows POST with authorization / content-type."""
    r = api.options('/api/v1/courses/instructor/courses/', HTTP_ORIGIN=DEV_ORIGIN,
                    HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
                    HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type')

    assert r.status_code == 200
    assert r['Access-Control-Allow-Origin'] == DEV_ORIGIN
    assert 'POST' in r['Access-Control-Allow-Methods']
    allowed = r['Access-Control-Allow-Headers'].lower()
    assert 'authorization' in allowed and 'content-type' in allowed


def test_authentication_failures_use_the_bearer_scheme(api, auth_client, student):
    """401 carries a Bearer challenge; 403 is a plain detail payload."""
    r = api.get('/api/v1/learning/enrolled/')
    assert r.status_code == 401
    assert r['WWW-Authenticate'].startswith('Bearer')
    assert 'detail' in r.json()

    r = auth_client(student).get('/api/v1/courses/instructor/courses/')
    assert r.status_code == 403
    assert 'detail' in r.json()
