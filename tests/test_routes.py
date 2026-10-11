"""Route table snapshot.

``tests/routes.baseline.txt`` holds one line per route::

    <full pattern> | <METHODS> | <url name or ->

The test compares the live URLconf (plus the websocket routes) with it.  Run
with ``UPDATE_ROUTES=1`` to regenerate the baseline after an *intended* change
(PowerShell)::

    $env:UPDATE_ROUTES = '1'; python -m pytest tests/test_routes.py; Remove-Item Env:UPDATE_ROUTES
"""
import difflib
import os
from pathlib import Path

import route_table

BASELINE = Path(__file__).with_name('routes.baseline.txt')


def _read_baseline():
    return BASELINE.read_text(encoding='utf-8').splitlines()


def test_route_table_matches_the_baseline():
    """The live route table equals tests/routes.baseline.txt (UPDATE_ROUTES=1 rewrites it)."""
    current = route_table.collect_routes()

    if os.environ.get('UPDATE_ROUTES') == '1':
        BASELINE.write_text('\n'.join(current) + '\n', encoding='utf-8', newline='\n')

    expected = _read_baseline()
    if current != expected:
        diff = '\n'.join(difflib.unified_diff(expected, current, 'routes.baseline.txt',
                                              'current URLconf', lineterm='', n=0))
        raise AssertionError(
            'The route table changed.  If that is intended re-run with UPDATE_ROUTES=1.\n' + diff)


def test_route_table_is_collected_correctly():
    """Guards the collector itself (an empty table would trivially match)."""
    lines = route_table.collect_routes()
    assert len(lines) > 60
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
