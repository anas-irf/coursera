"""The refactor moved code, not data: app labels, tables and migration state must stay put."""
import io

import pytest
from django.apps import apps
from django.core.management import call_command

# package -> label it had before the packages were named after the product slices
PINNED_LABELS = {
    'apps.learning': 'enrollments',
    'apps.billing': 'payments',
    'apps.messaging': 'discussions',
    'apps.insights': 'analytics',
}

# (label, model) -> table; the tables were created under the old module layout
PINNED_TABLES = {
    ('accounts', 'User'): 'users',
    ('enrollments', 'Enrollment'): 'enrollments',
    ('payments', 'SubscriptionPlan'): 'subscription_plans',
    ('payments', 'StudentPlusSubscription'): 'student_plus_subscriptions',
    ('payments', 'StudentPlusPayment'): 'student_plus_payments',
    ('discussions', 'DirectMessage'): 'direct_messages',
}


@pytest.mark.parametrize('package,label', sorted(PINNED_LABELS.items()))
def test_renamed_packages_keep_their_original_app_label(package, label):
    config = apps.get_app_config(label)

    assert config.name == package


@pytest.mark.parametrize('key,table', sorted(PINNED_TABLES.items()))
def test_models_keep_their_original_tables(key, table):
    label, model = key

    assert apps.get_model(label, model)._meta.db_table == table


def test_subscription_models_moved_out_of_accounts():
    from apps.accounts import models as accounts_models
    from apps.billing import models as billing_models

    assert not hasattr(accounts_models, 'StudentPlusSubscription')
    assert not hasattr(accounts_models, 'StudentPlusPayment')
    assert billing_models.StudentPlusSubscription._meta.app_label == 'payments'
    # the one-to-one accessor on the user is unchanged
    assert billing_models.StudentPlusSubscription._meta.get_field('student').remote_field.related_name \
        == 'plus_subscription'


@pytest.mark.django_db
def test_models_and_migrations_are_in_sync():
    """A schema change must come with a migration (and the other way round)."""
    call_command('makemigrations', check=True, dry_run=True, stdout=io.StringIO())
