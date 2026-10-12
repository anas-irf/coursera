"""Create the PostgreSQL role and database the development settings point at.

Run it once after installing PostgreSQL::

    python manage.py create_dev_database

The target is read the way the application reads it (DB_NAME, DB_USER,
DB_PASSWORD, DB_HOST and DB_PORT from the environment or backend/.env).  The
command connects as the PostgreSQL superuser, asks for its password unless
PGPASSWORD is set, and creates the role and the database when they are missing.
An existing role gets its password and privileges aligned with .env, an existing
database is left alone, so running it again is harmless.
"""
import getpass
import os

import psycopg2
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from psycopg2 import sql

LOCAL_HOSTS = {'', 'localhost', '127.0.0.1', '::1'}


def check_target(target, *, allow_remote=False):
    """Raise ``CommandError`` unless ``target`` is a PostgreSQL entry this command may set up."""
    if 'postgresql' not in target['ENGINE']:
        raise CommandError('DB_ENGINE is not postgres: set DB_ENGINE=postgres and DB_PASSWORD '
                           'in backend/.env first.')
    if not target['PASSWORD']:
        raise CommandError(f'DB_PASSWORD is empty: choose a password for the "{target["USER"]}" '
                           'role in backend/.env first.')
    host = target['HOST'] or ''
    if host not in LOCAL_HOSTS and not allow_remote:
        raise CommandError(f'DB_HOST is "{host}", which is not this machine; '
                           'pass --allow-remote if that is intended.')


def provision(target, *, admin_user, admin_password, maintenance_db='postgres',
              connect=psycopg2.connect, log=print):
    """Create the role and the database described by ``target`` (a Django DATABASES entry).

    Returns ``(role_created, database_created)``.
    """
    connection = connect(
        dbname=maintenance_db, user=admin_user, password=admin_password,
        host=target['HOST'] or 'localhost', port=target['PORT'] or 5432,
    )
    # CREATE DATABASE cannot run inside a transaction block
    connection.autocommit = True
    try:
        with connection.cursor() as cursor:
            role_created = _ensure_role(cursor, target['USER'], target['PASSWORD'], log)
            database_created = _ensure_database(cursor, target['NAME'], target['USER'], log)
    finally:
        connection.close()
    return role_created, database_created


def _ensure_role(cursor, user, password, log):
    cursor.execute('SELECT 1 FROM pg_roles WHERE rolname = %s', [user])
    exists = cursor.fetchone() is not None
    # CREATEDB lets Django's test runner create its own test_<name> database
    cursor.execute(
        sql.SQL('{} ROLE {} WITH LOGIN CREATEDB PASSWORD %s').format(
            sql.SQL('ALTER' if exists else 'CREATE'), sql.Identifier(user)),
        [password],
    )
    log(f'Role {user}: ' + ('password and privileges updated' if exists else 'created'))
    return not exists


def _ensure_database(cursor, name, owner, log):
    cursor.execute('SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname = %s', [name])
    row = cursor.fetchone()
    if row is not None:
        note = '' if row[0] == owner else f' (owned by {row[0]}, not by {owner})'
        log(f'Database {name}: already exists{note}')
        return False
    cursor.execute(sql.SQL('CREATE DATABASE {} OWNER {}').format(sql.Identifier(name), sql.Identifier(owner)))
    log(f'Database {name}: created, owned by {owner}')
    return True


class Command(BaseCommand):
    help = 'Create the PostgreSQL role and database of the development settings (run once)'
    # nothing here touches the application database, which may not exist yet
    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument('--admin-user', default='postgres',
                            help='PostgreSQL superuser used to create the role (default: postgres)')
        parser.add_argument('--maintenance-db', default='postgres',
                            help='database to connect to while creating the new one (default: postgres)')
        parser.add_argument('--allow-remote', action='store_true',
                            help='allow a DB_HOST that is not this machine')

    def handle(self, *args, **options):
        target = settings.DATABASES['default']
        check_target(target, allow_remote=options['allow_remote'])

        admin_user = options['admin_user']
        admin_password = os.environ.get('PGPASSWORD') or getpass.getpass(
            f'Password of the PostgreSQL user "{admin_user}": ')
        try:
            provision(target, admin_user=admin_user, admin_password=admin_password,
                      maintenance_db=options['maintenance_db'], log=self.stdout.write)
        except psycopg2.OperationalError as error:
            raise CommandError(f'Could not connect as "{admin_user}": {str(error).strip()}') from error

        self.stdout.write(self.style.SUCCESS('Done. Next: python manage.py migrate'))
