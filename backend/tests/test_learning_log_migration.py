"""enrollments.0003: the daily learning log in seconds, unique per student and day."""
from datetime import date

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

import factories as f

BEFORE = [('enrollments', '0002_drop_lecture_notes_and_enrollment_expiry')]
AFTER = [('enrollments', '0003_activity_log_in_seconds')]


def migrate(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps


@pytest.mark.django_db(transaction=True)
def test_minutes_become_seconds_and_a_day_may_be_logged_by_every_student():
    first, second = f.make_student(), f.make_student()   # real users: only the log table is rewound
    apps = migrate(BEFORE)
    try:
        LearningStreak = apps.get_model('enrollments', 'LearningStreak')
        day = date(2026, 3, 9)
        LearningStreak.objects.create(student_id=first.pk, streak_date=day, minutes_learned=12)

        apps = migrate(AFTER)
        LearningStreak = apps.get_model('enrollments', 'LearningStreak')

        assert LearningStreak.objects.get(student_id=first.pk, streak_date=day).seconds_learned == 720
        # the date used to be unique across all students
        LearningStreak.objects.create(student_id=second.pk, streak_date=day, seconds_learned=30)
        assert LearningStreak.objects.filter(streak_date=day).count() == 2
    finally:
        migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
