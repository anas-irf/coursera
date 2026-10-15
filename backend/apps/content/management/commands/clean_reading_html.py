"""Clean the HTML of reading lectures that were stored before it was sanitised on write.

    python manage.py clean_reading_html --dry-run   # which readings would change
    python manage.py clean_reading_html             # clean them

Cleaning is idempotent: a reading that is already clean is left alone, so the command can be
run again (or scheduled) without effect.
"""
from django.core.management.base import BaseCommand

from apps.content.models import Reading
from apps.core.utils import sanitize_html


class Command(BaseCommand):
    help = 'Remove scripts, event handlers and unsafe URLs from the stored HTML of reading lectures.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='list the readings that would change, change none')

    def handle(self, *args, dry_run=False, **options):
        checked = changed = 0
        for reading in Reading.objects.exclude(content='').select_related('lecture').iterator():
            checked += 1
            cleaned = sanitize_html(reading.content)
            if cleaned == reading.content:
                continue
            changed += 1
            self.stdout.write(f'{"would clean" if dry_run else "cleaned"}: {reading.lecture.title} '
                              f'(lecture {reading.lecture.uuid})')
            if not dry_run:
                Reading.objects.filter(pk=reading.pk).update(content=cleaned)

        verb = 'would change' if dry_run else 'changed'
        self.stdout.write(self.style.SUCCESS(f'{checked} readings checked, {changed} {verb}.'))
