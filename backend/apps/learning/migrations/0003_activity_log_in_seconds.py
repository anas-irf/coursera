"""The daily learning log: one row per student and day, in seconds.

``streak_date`` was unique over *all* students, so a second student could never have a
row for a day somebody else had already used; the pair (student, day) is what is unique.
Minutes become seconds, because that is what the player's heartbeat measures.
"""
from django.db import migrations, models


def minutes_to_seconds(apps, schema_editor):
    LearningStreak = apps.get_model('enrollments', 'LearningStreak')
    for row in LearningStreak.objects.exclude(minutes_learned=0):
        row.seconds_learned = row.minutes_learned * 60
        row.save(update_fields=['seconds_learned'])


def seconds_to_minutes(apps, schema_editor):
    LearningStreak = apps.get_model('enrollments', 'LearningStreak')
    for row in LearningStreak.objects.exclude(seconds_learned=0):
        row.minutes_learned = row.seconds_learned // 60
        row.save(update_fields=['minutes_learned'])


class Migration(migrations.Migration):

    dependencies = [
        ('enrollments', '0002_drop_lecture_notes_and_enrollment_expiry'),
    ]

    operations = [
        migrations.AlterField(
            model_name='learningstreak',
            name='streak_date',
            field=models.DateField(),
        ),
        migrations.AddField(
            model_name='learningstreak',
            name='seconds_learned',
            field=models.IntegerField(default=0),
        ),
        migrations.RunPython(minutes_to_seconds, seconds_to_minutes),
        migrations.RemoveField(
            model_name='learningstreak',
            name='minutes_learned',
        ),
    ]
