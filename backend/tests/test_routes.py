"""Route table snapshot.

``tests/routes.expected.txt`` is the table the project must have: one line per
route::

    <full pattern> | <METHODS> | <url name or ->

Adding, renaming or removing an endpoint changes the table on purpose.  Run with
``UPDATE_ROUTES=1`` to regenerate the file after an intended change, then review
the diff (PowerShell)::

    $env:UPDATE_ROUTES = '1'; python -m pytest tests/test_routes.py
"""
import difflib
import os
from pathlib import Path

import route_table

EXPECTED = Path(__file__).parent / 'routes.expected.txt'


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
    assert has('api/learning/courses/ | GET | ')
    assert has('api/courses/instructor/sections/<uuid:section_uuid>/lectures/ | GET,POST | ')
    assert has('api/payments/stripe/webhook/ | POST | ')
    assert has('api/messaging/send/ | POST | ')
    assert has('ws/chat/<str:conversation_id>/ | WS | ')
    assert has('ws/user/ | WS | ')
    assert not any(line.startswith('admin/') for line in lines)


def test_every_api_route_lives_under_its_slice_prefix():
    """Only the Stripe webhook sits outside the /api/<slice>/ scheme."""
    slices = ('auth', 'courses', 'learning', 'assessments', 'billing', 'insights',
              'certificates', 'messaging', 'notifications')
    outside = []
    for line in route_table.collect_routes():
        pattern = line.split(' | ')[0]
        if pattern.startswith('ws/'):
            continue
        parts = pattern.split('/')
        if parts[0] != 'api' or parts[1] not in slices:
            outside.append(pattern)

    assert outside == ['api/payments/stripe/webhook/']


def test_route_table_does_not_depend_on_requests_having_been_served(auth_client, student):
    """DRF lazily adds HEAD to ViewSet action maps; the table must ignore it."""
    before = route_table.collect_routes()
    assert auth_client(student).get('/api/learning/courses/').status_code == 200
    assert auth_client(student).get('/api/courses/instructor/courses/').status_code == 403

    assert route_table.collect_routes() == before
