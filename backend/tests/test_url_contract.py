"""The frontend and the backend agree on URLs.

Every request the frontend's ``api`` modules (``features/<slice>/api.ts`` and ``shared/auth/api.ts``)
can make is resolved against Django's URLconf: the path must exist and accept the HTTP method.  The
check reads the modules' source, so a typo in a path or a rename on either side fails here instead
of in somebody's browser.
"""
import re
import uuid
from pathlib import Path

import pytest
from django.urls import Resolver404, resolve

import route_table

FRONTEND = Path(__file__).resolve().parents[2] / 'frontend' / 'src'
pytestmark = pytest.mark.skipif(not FRONTEND.exists(), reason='frontend sources are not checked out')

# ``api.get('/x/')`` and ``api.get<Course[]>('/x/')``: a type argument may sit before the parenthesis
CALL = re.compile(
    r"""\bapi\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^()]*>)?\s*\(\s*(?P<url>`[^`]*`|'[^']*')""", re.S
)
CONSTANT = re.compile(r"""^const\s+([A-Z_]+)\s*=\s*['"]([^'"]+)['"];""", re.M)
SAMPLE_UUID = str(uuid.uuid4())


def api_modules():
    # ``api.js`` while a slice is still JavaScript, ``api.ts`` once it is converted
    files = sorted(FRONTEND.glob('features/*/api.[jt]s')) + sorted(FRONTEND.glob('shared/auth/api.[jt]s'))
    return [path for path in files if path.exists()]


def requests_of(path):
    """``(method, url template)`` of every call in one module."""
    source = path.read_text(encoding='utf-8')
    constants = dict(CONSTANT.findall(source))
    found = []
    for match in CALL.finditer(source):
        url = match.group('url')[1:-1]
        for name, value in constants.items():
            url = url.replace('${' + name + '}', value)
        found.append((match.group(1).upper(), url))
    return found


def candidates(template):
    """Concrete URLs for a template: ids are uuids, or small integers."""
    with_uuid = re.sub(r'\$\{[^}]+\}', SAMPLE_UUID, template)
    with_number = re.sub(r'\$\{[^}]+\}', '1', template)
    return ['/api/v1' + with_uuid, '/api/v1' + with_number]


def allowed_methods(match):
    return {method.upper() for method in route_table._methods(match.func)}


def test_the_api_modules_were_found():
    names = {path.parent.name for path in api_modules()}

    assert {'learning', 'assessments', 'billing', 'insights', 'courses', 'messaging',
            'notifications', 'admin', 'certificates', 'auth'} <= names
    assert sum(len(requests_of(path)) for path in api_modules()) > 40


def test_a_call_with_a_type_argument_is_read(tmp_path):
    module = tmp_path / 'api.ts'
    module.write_text(
        "const BASE = '/courses/instructor';\n"
        "export const list = () => api.get<Course[]>(`${BASE}/courses/`).then((r) => r.data);\n"
        "export const make = (body: Body) => api.post<{ id: string; title: string }>('/courses/x/', body);\n"
        "export const drop = (id: string) => api.delete(`${BASE}/sections/${id}/`);\n",
        encoding='utf-8',
    )

    assert requests_of(module) == [
        ('GET', '/courses/instructor/courses/'),
        ('POST', '/courses/x/'),
        ('DELETE', '/courses/instructor/sections/${id}/'),
    ]


@pytest.mark.parametrize('module', api_modules(), ids=lambda path: path.parent.name)
def test_every_frontend_request_matches_a_route(module):
    problems = []
    for method, template in requests_of(module):
        resolved = None
        for url in candidates(template):
            try:
                resolved = resolve(url)
                break
            except Resolver404:
                continue
        if resolved is None:
            problems.append(f'{method} {template}: no such route')
        elif method not in allowed_methods(resolved):
            problems.append(f'{method} {template}: route accepts {sorted(allowed_methods(resolved))}')

    assert not problems, '\n'.join(problems)


def test_websocket_paths_used_by_the_frontend_exist():
    hooks = sorted(FRONTEND.glob('features/messaging/hooks/useChat.[jt]s'))
    assert len(hooks) == 1, hooks
    source = hooks[0].read_text(encoding='utf-8')
    paths = re.findall(r"""path:\s*(?:activeId\s*\?\s*)?[`'](/ws/[^`']+)[`']""", source)
    routes = [line.split(' | ')[0] for line in route_table.collect_routes() if ' | WS | ' in line]

    assert len(paths) == 2, paths
    for path in paths:
        shape = re.sub(r'\$\{[^}]+\}', '<str:conversation_id>', path.lstrip('/'))
        assert shape in routes, (path, routes)
