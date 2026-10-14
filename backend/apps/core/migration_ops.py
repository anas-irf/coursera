"""Migration operations that never destroy data silently.

``GuardedDeleteModel`` and ``GuardedRemoveField`` behave exactly like Django's
``DeleteModel`` and ``RemoveField`` (same state changes, same reverse) but stop
with ``DataStillPresent`` *before* anything is dropped when the table still
holds rows, or when a column holds a value other than its default.  A fresh
database, CI and development databases pass straight through; a database that
actually used the feature is left untouched until someone has looked at it.
"""
from django.db import migrations
from django.db.models import Q


class DataStillPresent(RuntimeError):
    """Raised instead of dropping a table or a column that still holds data."""


class GuardedDeleteModel(migrations.DeleteModel):
    """``DeleteModel`` that refuses to drop a table that still has rows."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        alias = schema_editor.connection.alias
        model = from_state.apps.get_model(app_label, self.name)
        if self.allow_migrate_model(alias, model):
            rows = model._default_manager.using(alias).count()
            if rows:
                raise DataStillPresent(
                    f'{app_label}.{self.name} still holds {rows} row(s); its table is not dropped. '
                    'Export or delete the rows, then run the migration again.'
                )
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class GuardedRemoveField(migrations.RemoveField):
    """``RemoveField`` that refuses to drop a column holding anything but its default."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        alias = schema_editor.connection.alias
        model = from_state.apps.get_model(app_label, self.model_name)
        if self.allow_migrate_model(alias, model):
            field = model._meta.get_field(self.name)
            empty = Q(**{self.name: field.get_default()}) | Q(**{f'{self.name}__isnull': True})
            used = model._default_manager.using(alias).exclude(empty).count()
            if used:
                raise DataStillPresent(
                    f'{app_label}.{self.model_name}.{self.name} holds a value in {used} row(s); '
                    'the column is not dropped. Clear or export it, then run the migration again.'
                )
        super().database_forwards(app_label, schema_editor, from_state, to_state)
