"""create_dev_database: its guard rails and the statements it sends (no server needed)."""
import pytest
from django.core.management.base import CommandError

from apps.seeding.management.commands import create_dev_database as command

TARGET = {
    'ENGINE': 'django.db.backends.postgresql',
    'NAME': 'coursera_db',
    'USER': 'coursera_admin',
    'PASSWORD': 'a-dev-password',
    'HOST': 'localhost',
    'PORT': '5432',
}


class FakeCursor:
    def __init__(self, server):
        self.server = server
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, query, params=None):
        text = query if isinstance(query, str) else repr(query)
        self.server.statements.append((text, params))
        if 'FROM pg_roles' in text:
            self.row = (1,) if params[0] in self.server.roles else None
        elif 'FROM pg_database' in text:
            self.row = (self.server.databases[params[0]],) if params[0] in self.server.databases else None

    def fetchone(self):
        return self.row


class FakeServer:
    """Just enough of psycopg2 to record what provision() asks for."""

    def __init__(self, roles=(), databases=None):
        self.roles = set(roles)
        self.databases = dict(databases or {})
        self.statements = []
        self.connect_args = None
        self.autocommit = None
        self.closed = False

    def connect(self, **kwargs):
        self.connect_args = kwargs
        return self

    def cursor(self):
        return FakeCursor(self)

    def close(self):
        self.closed = True

    def sql_text(self):
        return ' | '.join(text for text, _ in self.statements)


def provision(server, **overrides):
    messages = []
    options = {'admin_user': 'postgres', 'admin_password': 'superuser-pw', 'connect': server.connect,
               'log': messages.append}
    options.update(overrides)
    return command.provision(TARGET, **options), messages


def test_creates_the_role_and_the_database_when_both_are_missing():
    server = FakeServer()

    (role_created, database_created), messages = provision(server)

    assert (role_created, database_created) == (True, True)
    text = server.sql_text()
    assert "SQL('CREATE')" in text and "Identifier('coursera_admin')" in text
    assert 'LOGIN CREATEDB PASSWORD %s' in text
    assert 'CREATE DATABASE' in text and "Identifier('coursera_db')" in text
    assert any('created' in message for message in messages)


def test_the_password_is_sent_as_a_parameter_never_inlined():
    server = FakeServer()

    provision(server)

    assert not any('a-dev-password' in text for text, _ in server.statements)
    assert ['a-dev-password'] in [params for _, params in server.statements]


def test_an_existing_role_is_altered_and_an_existing_database_is_kept():
    server = FakeServer(roles={'coursera_admin'}, databases={'coursera_db': 'coursera_admin'})

    (role_created, database_created), messages = provision(server)

    assert (role_created, database_created) == (False, False)
    assert "SQL('ALTER')" in server.sql_text()
    assert 'CREATE DATABASE' not in server.sql_text()
    assert any('already exists' in message for message in messages)


def test_a_database_with_another_owner_is_reported_not_changed():
    server = FakeServer(roles={'coursera_admin'}, databases={'coursera_db': 'postgres'})

    _, messages = provision(server)

    assert any('owned by postgres' in message for message in messages)
    assert 'CREATE DATABASE' not in server.sql_text()


def test_it_connects_to_the_maintenance_database_with_autocommit_and_closes():
    server = FakeServer()

    provision(server, maintenance_db='template1')

    assert server.connect_args['dbname'] == 'template1'
    assert server.connect_args['user'] == 'postgres'
    assert server.connect_args['host'] == 'localhost'
    assert server.autocommit is True
    assert server.closed is True


def test_the_connection_is_closed_when_a_statement_fails():
    server = FakeServer()
    server.cursor = lambda: (_ for _ in ()).throw(RuntimeError('boom'))

    with pytest.raises(RuntimeError):
        provision(server)

    assert server.closed is True


@pytest.mark.parametrize('changes, expected', [
    ({'ENGINE': 'django.db.backends.sqlite3'}, 'DB_ENGINE is not postgres'),
    ({'PASSWORD': ''}, 'DB_PASSWORD is empty'),
    ({'HOST': 'db.example.org'}, 'not this machine'),
])
def test_it_refuses_to_set_up_the_wrong_target(changes, expected):
    with pytest.raises(CommandError, match=expected):
        command.check_target({**TARGET, **changes})


@pytest.mark.parametrize('host', ['', 'localhost', '127.0.0.1', '::1'])
def test_local_hosts_are_accepted(host):
    command.check_target({**TARGET, 'HOST': host})


def test_a_remote_host_needs_the_explicit_flag():
    command.check_target({**TARGET, 'HOST': 'db.example.org'}, allow_remote=True)
