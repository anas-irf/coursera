"""Receive the Coursera Plus subscription models from the accounts app.

State only: the tables already exist (created by ``accounts.0002``), nothing is
altered in the database.  The content types and their permissions are re-labelled
so existing grants keep pointing at the same rows.
"""
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models

MOVED_MODELS = ['studentplussubscription', 'studentpluspayment']


def relabel_content_types(apps, schema_editor):
    ContentType = apps.get_model('contenttypes', 'ContentType')
    using = schema_editor.connection.alias
    for model in MOVED_MODELS:
        if ContentType.objects.using(using).filter(app_label='payments', model=model).exists():
            continue
        ContentType.objects.using(using).filter(
            app_label='accounts', model=model
        ).update(app_label='payments')


def restore_content_types(apps, schema_editor):
    ContentType = apps.get_model('contenttypes', 'ContentType')
    using = schema_editor.connection.alias
    for model in MOVED_MODELS:
        if ContentType.objects.using(using).filter(app_label='accounts', model=model).exists():
            continue
        ContentType.objects.using(using).filter(
            app_label='payments', model=model
        ).update(app_label='accounts')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_move_subscription_models_to_billing'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('payments', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='StudentPlusSubscription',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('uuid', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('subscription_type', models.CharField(choices=[('monthly', 'Monthly'), ('yearly', 'Yearly')], max_length=20)),
                        ('status', models.CharField(choices=[('active', 'Active'), ('cancelled', 'Cancelled'), ('expired', 'Expired'), ('pending', 'Pending Payment')], default='pending', max_length=20)),
                        ('start_date', models.DateTimeField(default=django.utils.timezone.now)),
                        ('end_date', models.DateTimeField(blank=True, null=True)),
                        ('auto_renew', models.BooleanField(default=True)),
                        ('payment_method', models.CharField(blank=True, max_length=50)),
                        ('last_payment_date', models.DateTimeField(blank=True, null=True)),
                        ('next_billing_date', models.DateTimeField(blank=True, null=True)),
                        ('student', models.OneToOneField(limit_choices_to={'user_type': 'student'}, on_delete=django.db.models.deletion.CASCADE, related_name='plus_subscription', to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'db_table': 'student_plus_subscriptions',
                    },
                ),
                migrations.CreateModel(
                    name='StudentPlusPayment',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('uuid', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('currency', models.CharField(default='USD', max_length=3)),
                        ('status', models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed'), ('refunded', 'Refunded')], default='pending', max_length=20)),
                        ('payment_date', models.DateTimeField(auto_now_add=True)),
                        ('payment_method', models.CharField(max_length=50)),
                        ('transaction_id', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                        ('subscription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='payments.studentplussubscription')),
                    ],
                    options={
                        'db_table': 'student_plus_payments',
                        'ordering': ['-payment_date'],
                    },
                ),
            ],
        ),
        migrations.RunPython(relabel_content_types, restore_content_types),
    ]
