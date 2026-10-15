"""The v1 contract, written down and compared with what the code serves.

``openapi.v1.yaml`` is the OpenAPI document of ``/api/v1/``: every path and method, its path
parameters, how it authenticates and the request and response bodies wherever a serializer
defines them.  v1 is frozen: a path, a method, a parameter or a field may be *added*; anything
that disappears or changes type is a v2 change.  This test fails on every difference so that a
change to the contract is always a visible change in a pull request.

After an intended (additive) change, regenerate and review the diff::

    UPDATE_OPENAPI=1 python -m pytest tests/test_openapi.py
"""
import json
import os
import re
from pathlib import Path

import pytest
import yaml
from drf_spectacular.generators import SchemaGenerator

import openapi_extensions  # noqa: F401  (registers how the authentication classes are described)

SNAPSHOT = Path(__file__).resolve().parent / 'openapi.v1.yaml'
V1 = '/api/v1/'


def current_contract():
    """The schema of the v1 routes as plain, sorted YAML."""
    schema = SchemaGenerator().get_schema(request=None, public=True)
    schema['paths'] = {path: item for path, item in schema['paths'].items() if path.startswith(V1)}
    # plain data (no ordered dicts or lazy strings), keys in a stable order
    plain = json.loads(json.dumps(schema, default=str))
    return yaml.safe_dump(plain, sort_keys=True, default_flow_style=False, allow_unicode=True, width=100)


@pytest.fixture(scope='module')
def contract():
    return current_contract()


def test_the_v1_contract_has_not_changed(contract):
    if os.environ.get('UPDATE_OPENAPI'):
        SNAPSHOT.write_text(contract, encoding='utf-8', newline='\n')
        pytest.skip('openapi.v1.yaml rewritten')

    assert SNAPSHOT.exists(), 'run UPDATE_OPENAPI=1 python -m pytest tests/test_openapi.py'
    expected = SNAPSHOT.read_text(encoding='utf-8').replace('\r\n', '\n')

    assert contract == expected, (
        'the v1 contract changed.  If the change is additive and intended, regenerate the file with '
        'UPDATE_OPENAPI=1 python -m pytest tests/test_openapi.py and review the diff; anything that '
        'removes or retypes a path, method, parameter or field belongs to v2.'
    )


def test_every_v1_route_is_in_the_contract(contract):
    """The route snapshot and the contract describe the same set of paths."""
    document = yaml.safe_load(contract)
    paths = set(document['paths'])
    routes = (Path(__file__).resolve().parent / 'routes.expected.txt').read_text(encoding='utf-8').splitlines()
    # lines are "api/v1/<path> | METHODS | name"
    snapshot = {'/' + line.split(' | ')[0] for line in routes if line.startswith('api/v1/')}

    def normal(path):
        # {id}, <uuid:name> and the router's (?P<pk>[^/.]+) are the same parameter in three notations
        return re.sub(r'<[^>]+>|{[^}]+}|\(\?P<[^>]+>[^)]+\)', '{}', path)

    assert snapshot, 'the route snapshot lists no v1 route'
    assert {normal(path) for path in snapshot} <= {normal(path) for path in paths}


def test_the_contract_declares_how_a_request_is_authenticated(contract):
    document = yaml.safe_load(contract)
    schemes = document['components']['securitySchemes']

    assert 'sessionCookie' in schemes
    assert schemes['sessionCookie']['in'] == 'cookie'
    assert 'bearerToken' in schemes
