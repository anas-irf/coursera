"""Issue the certificates that were earned before certificates were issued automatically.

    python manage.py issue_certificates --dry-run     # what would be issued
    python manage.py issue_certificates               # issue them (silently)
    python manage.py issue_certificates --notify      # ... and tell the students

A completed enrollment without a certificate is looked at with the same rule the application
applies when a course completes (``certificates.services.verdict``), so running it twice
changes nothing the second time.  The certificate is dated the day the course was completed.
"""
from django.core.management.base import BaseCommand

from apps.certificates import services
from apps.certificates.models import Certificate
from apps.learning.models import Enrollment


class Command(BaseCommand):
    """Issues the certificates of completed enrolments that earned one."""
    help = 'Issue the certificates of completed enrollments that earned one but have none.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='list what would be issued, change nothing')
        parser.add_argument('--notify', action='store_true',
                            help='send the "certificate earned" notification (silent by default)')

    def handle(self, *args, dry_run=False, notify=False, **options):
        pending = (
            Enrollment.objects.filter(status='completed')
            .exclude(pk__in=Certificate.objects.values('enrollment_id'))
            .select_related('student', 'course')
            .order_by('completed_date', 'id')
        )

        issued = waiting = failing = 0
        for enrollment in pending:
            eligible, grade = services.verdict(enrollment)
            if not eligible:
                if grade is None:
                    waiting += 1   # work is waiting for the instructor's grade
                else:
                    failing += 1
                continue

            label = f'{enrollment.student.email} / {enrollment.course.title}'
            if dry_run:
                self.stdout.write(f'would issue: {label} (grade {grade if grade is not None else "-"})')
            else:
                services.issue_if_eligible(
                    enrollment, announce=notify, issued_at=enrollment.completed_date)
                self.stdout.write(f'issued: {label}')
            issued += 1

        verb = 'would be issued' if dry_run else 'issued'
        self.stdout.write(self.style.SUCCESS(
            f'{issued} certificates {verb}; {failing} below the pass mark, {waiting} waiting for a grade.'))
