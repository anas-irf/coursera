"""Calculate the instructors' earnings of a finished month.

    python manage.py calculate_earnings                    # last month
    python manage.py calculate_earnings --month 2026-09
    python manage.py calculate_earnings --month 2026-09 --dry-run

The month is calculated once, after it ended, and then frozen.  ``--dry-run`` prints what would
be recorded and writes nothing; it works for a month that has not ended too.  Schedule it for
the first day of every month, for the month before (cron: ``0 3 1 * *``).  Nothing here pays
an instructor: the figures are recorded, ``is_paid`` stays false.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.billing.services.earnings import month_start
from apps.core.api.errors import ServiceError
from apps.insights import earnings


def last_month(today):
    return month_start(month_start(today) - timedelta(days=1))


def parse_month(value):
    try:
        year, month = value.split('-')
        return date(int(year), int(month), 1)
    except ValueError as error:
        raise CommandError('--month must look like 2026-09') from error


class Command(BaseCommand):
    help = "Calculate and record the instructors' earnings of a finished month."

    def add_arguments(self, parser):
        parser.add_argument('--month', help='YYYY-MM (default: last month)')
        parser.add_argument('--dry-run', action='store_true', help='show the figures, record nothing')

    def handle(self, *args, month=None, dry_run=False, **options):
        today = timezone.now().date()
        target = parse_month(month) if month else last_month(today)

        if dry_run:
            self._show(earnings.preview(target), recorded=False)
            return

        try:
            earnings.calculate_month(target)
        except ServiceError as error:
            raise CommandError(error.message) from error
        self._show(earnings.preview(target), recorded=True)

    def _show(self, result, *, recorded):
        status = 'recorded and frozen' if recorded else ('already frozen' if result['frozen'] else 'dry run')
        self.stdout.write(f"{result['month']:%B %Y} ({status})")
        self.stdout.write(f"  Plus revenue  {result['revenue']}")
        self.stdout.write(f"  instructors'  {result['pool']}")
        for row in result['courses']:
            self.stdout.write(
                f"  {row['amount']:>10}  x{row['multiplier']}  {row['enrollments']:>4} enrolled  "
                f"{row['course'].title}")
