"""Route table snapshot.

* ``tests/routes.baseline.txt`` - the table of the project as it was before the
  refactor (never rewritten; kept as the reference point).
* ``tests/routes.expected.txt`` - the table the refactor must converge on:
  the baseline minus the endpoints deleted in step S1a (plus intended renames in
  the URL-normalisation step).

One line per route::

    <full pattern> | <METHODS> | <url name or ->

Run with ``UPDATE_ROUTES=1`` to regenerate the *expected* file after an intended
change (PowerShell)::

    $env:UPDATE_ROUTES = '1'; python -m pytest tests/test_routes.py
"""
import difflib
import os
from pathlib import Path

import route_table

HERE = Path(__file__).parent
BASELINE = HERE / 'routes.baseline.txt'
EXPECTED = HERE / 'routes.expected.txt'

# Baseline lines that step S1a removed ...
REMOVED_LINES = {
    'api/auth/student/create-subscription/ | POST | create_plus_subscription',
    'api/auth/student/debug-subscription/ | GET | debug_subscription',
    'api/courses/instructor/courses/(?P<pk>[^/.]+)/publish/ | POST | instructor-courses-publish',
    'api/courses/instructor/courses/(?P<pk>[^/.]+)/test_endpoint/ | GET | instructor-courses-test-endpoint',
    'api/courses/instructor/students/ | GET | instructor-students',
    'api/courses/notifications/test/ | POST | create-test-notification',
    'api/courses/student/stats/ | GET | student-stats',
    'api/courses/student/weekly-progress/ | GET | weekly-progress',
    'api/payments/checkout/process/ | POST | checkout-process',
    'api/payments/checkout/validate/ | POST | validate-payment',
    'api/payments/debug/manual-subscription/ | POST | manual-subscription-test',
    'api/payments/debug/test-recurring/ | POST | test-recurring-payment',
    'api/payments/debug/test-webhook/ | POST | test-webhook',
}
# ... and the lines that changed: plain DELETE of a course is gone (S1a), the learner
# roster and per-course analytics left the router for explicit UUID routes (S7).
CHANGED_LINES = {
    'api/courses/instructor/courses/(?P<pk>[^/.]+)/ | DELETE,GET,PATCH,PUT | instructor-courses-detail':
        'api/courses/instructor/courses/(?P<pk>[^/.]+)/ | GET,PATCH,PUT | instructor-courses-detail',
    'api/courses/instructor/courses/(?P<pk>[^/.]+)/analytics/ | GET | instructor-courses-analytics':
        'api/courses/instructor/courses/<uuid:course_uuid>/analytics/ | GET | instructor-courses-analytics',
    'api/courses/instructor/courses/(?P<pk>[^/.]+)/students/ | GET | instructor-courses-students':
        'api/courses/instructor/courses/<uuid:course_uuid>/students/ | GET | instructor-courses-students',
}


def _read(path):
    return path.read_text(encoding='utf-8').splitlines()


def test_route_table_matches_the_expected_table():
    """The live route table equals tests/routes.expected.txt (UPDATE_ROUTES=1 rewrites it)."""
    current = route_table.collect_routes()

    if os.environ.get('UPDATE_ROUTES') == '1':
        EXPECTED.write_text('\n'.join(current) + '\n', encoding='utf-8', newline='\n')

    expected = _read(EXPECTED)
    if current != expected:
        diff = '\n'.join(difflib.unified_diff(expected, current, 'routes.expected.txt',
                                              'current URLconf', lineterm='', n=0))
        raise AssertionError(
            'The route table changed.  If that is intended re-run with UPDATE_ROUTES=1.\n' + diff)


def test_expected_table_is_the_baseline_minus_the_removed_endpoints():
    """Documents exactly what the purge step removed from the public surface."""
    baseline = _read(BASELINE)
    derived = sorted(CHANGED_LINES.get(line, line) for line in baseline
                     if line not in REMOVED_LINES)

    # only compare the part of the table that is not renamed by later steps
    assert REMOVED_LINES <= set(baseline), 'removed lines must exist in the baseline'
    expected = set(_read(EXPECTED))
    assert not (REMOVED_LINES & expected), 'a removed endpoint is back in the expected table'
    missing = [line for line in derived if line not in expected]
    assert not missing, f'baseline routes missing from the expected table: {missing}'


def test_route_table_is_collected_correctly():
    """Guards the collector itself (an empty table would trivially match)."""
    lines = route_table.collect_routes()
    assert len(lines) > 55
    assert lines == sorted(lines)
    assert not any('(?P<format>' in line for line in lines)

    def has(prefix):
        return any(line.startswith(prefix) for line in lines)

    assert has('api/auth/login/ | POST | ')
    assert has('api/auth/token/refresh/ | POST | ')
    assert has('api/courses/all/ | GET | ')
    assert has('api/courses/instructor/sections/<uuid:section_uuid>/lectures/ | GET,POST | ')
    assert has('api/payments/stripe/webhook/ | POST | ')
    assert has('api/discussions/messages/send/ | POST | ')
    assert has('ws/chat/<str:conversation_id>/ | WS | ')
    assert has('ws/user/ | WS | ')
    assert not any(line.startswith('admin/') for line in lines)


def test_route_table_does_not_depend_on_requests_having_been_served(auth_client, student):
    """DRF lazily adds HEAD to ViewSet action maps; the table must ignore it."""
    before = route_table.collect_routes()
    assert auth_client(student).get('/api/courses/all/').status_code == 200
    assert auth_client(student).get('/api/courses/instructor/courses/').status_code == 403

    assert route_table.collect_routes() == before
