"""Fill a development database with a realistic cast, catalogue and activity.

    python manage.py seed_dev                    # create what is missing
    python manage.py seed_dev --password ...     # one password for every seeded user

Idempotent: running it again only creates what is missing.  All seeded users
share one password: ``--password``, else ``SEED_PASSWORD`` (backend/.env), else a
random one that is printed once.  The data lives in ``apps/seeding/data``; the
steps in ``apps/seeding/steps`` go through the application's own services.
"""
import io
import secrets

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.seeding import runner
from apps.seeding.context import SeedContext


class Command(BaseCommand):
    help = 'Create a realistic development dataset (safe to run repeatedly)'

    def add_arguments(self, parser):
        parser.add_argument('--password',
                            help='password of the seeded users (default: SEED_PASSWORD, else random)')
        parser.add_argument('--force', action='store_true',
                            help='allow running with DEBUG=False')

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError('Refusing to create demo accounts while DEBUG is off; '
                               'pass --force if this really is a development database.')

        password = options['password'] or settings.SEED_PASSWORD
        generated = not password
        if generated:
            password = secrets.token_urlsafe(12)

        ctx = SeedContext(password=password, stdout=self.stdout)

        with transaction.atomic():
            # the three headline accounts, the plans and two complete courses
            call_command('seed_demo', password=password, stdout=io.StringIO())
            runner.run(ctx)

        self.stdout.write(self.style.SUCCESS('Development data is ready.'))
        if generated:
            self.stdout.write(f'Password of the seeded users: {password}')
