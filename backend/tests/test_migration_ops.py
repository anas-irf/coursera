"""The guarded drop operations never destroy data silently.

``GuardedDeleteModel`` and ``GuardedRemoveField`` stand in for ``DeleteModel``
and ``RemoveField`` in the migrations that retire unused tables and columns.
They are exercised against the real model state with a stand-in schema editor,
so nothing is dropped from the test database.
"""
from unittest import mock

import pytest
from django.db import connection, migrations
from django.db.migrations.loader import MigrationLoader

import factories as f
from apps.core.migration_ops import DataStillPresent, GuardedDeleteModel, GuardedRemoveField


@pytest.fixture
def state(db):
    return MigrationLoader(connection).project_state()


@pytest.fixture
def editor():
    schema_editor = mock.Mock()
    schema_editor.connection.alias = 'default'
    return schema_editor


def test_a_table_with_rows_is_not_dropped(state, editor, student):
    f.make_notification(student)

    with pytest.raises(DataStillPresent, match=r'notifications\.Notification still holds 1 row'):
        GuardedDeleteModel('Notification').database_forwards('notifications', editor, state, state)

    editor.delete_model.assert_not_called()


def test_an_empty_table_is_dropped(state, editor):
    GuardedDeleteModel('Notification').database_forwards('notifications', editor, state, state)

    editor.delete_model.assert_called_once()


def test_a_column_holding_a_value_is_not_dropped(state, editor, student):
    f.make_notification(student, is_read=True)

    with pytest.raises(DataStillPresent, match=r'notification\.is_read holds a value in 1 row'):
        GuardedRemoveField('notification', 'is_read').database_forwards(
            'notifications', editor, state, state)

    editor.remove_field.assert_not_called()


def test_a_column_that_only_holds_its_default_is_dropped(state, editor, student):
    f.make_notification(student, is_read=False)  # is_read defaults to False, read_at to NULL

    GuardedRemoveField('notification', 'is_read').database_forwards('notifications', editor, state, state)
    GuardedRemoveField('notification', 'read_at').database_forwards('notifications', editor, state, state)

    assert editor.remove_field.call_count == 2


def test_migrations_that_drop_things_use_the_guards():
    """A migration called ``*_drop_*`` must not contain a plain DeleteModel or RemoveField."""
    plain = (migrations.DeleteModel, migrations.RemoveField)
    guarded = (GuardedDeleteModel, GuardedRemoveField)
    loader = MigrationLoader(None)  # reads the migration files only, no database

    offenders = [
        f'{app}.{name}'
        for (app, name), migration in loader.disk_migrations.items()
        if '_drop_' in name
        for operation in migration.operations
        if isinstance(operation, plain) and not isinstance(operation, guarded)
    ]

    assert offenders == []
