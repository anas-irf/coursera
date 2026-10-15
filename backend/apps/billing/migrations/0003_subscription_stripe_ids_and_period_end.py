"""Stripe ids on the subscription, and the end date renewals never moved.

* ``stripe_customer_id`` / ``stripe_subscription_id`` are what cancelling at Stripe needs.
* ``suspended`` is a status the failed-payment handler always wrote and the choices lacked.
* A renewal used to move ``next_billing_date`` and leave ``end_date`` at the end of the first
  period, so a member who kept paying lost Plus the day the first period ended.  Active rows
  whose billing date is beyond their end date get the end date they paid for.
"""
from django.db import migrations, models
from django.db.models import F


def extend_to_the_billing_date(apps, schema_editor):
    Subscription = apps.get_model('payments', 'StudentPlusSubscription')
    Subscription.objects.filter(
        status='active',
        next_billing_date__isnull=False,
        end_date__lt=F('next_billing_date'),
    ).update(end_date=F('next_billing_date'))


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_subscription_models_from_accounts'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentplussubscription',
            name='stripe_customer_id',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='studentplussubscription',
            name='stripe_subscription_id',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='studentplussubscription',
            name='status',
            field=models.CharField(choices=[('active', 'Active'), ('cancelled', 'Cancelled'), ('expired', 'Expired'), ('pending', 'Pending Payment'), ('suspended', 'Suspended')], default='pending', max_length=20),
        ),
        migrations.RunPython(extend_to_the_billing_date, migrations.RunPython.noop),
    ]
