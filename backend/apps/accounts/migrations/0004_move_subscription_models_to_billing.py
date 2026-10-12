"""The Coursera Plus subscription models moved to the billing app (label ``payments``).

State only: the tables ``student_plus_subscriptions`` and ``student_plus_payments``
stay exactly where they are, see ``payments.0002``.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_studentplussubscription_subscription_type'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='studentplussubscription',
                    name='student',
                ),
                migrations.DeleteModel(
                    name='StudentPlusPayment',
                ),
                migrations.DeleteModel(
                    name='StudentPlusSubscription',
                ),
            ],
        ),
    ]
