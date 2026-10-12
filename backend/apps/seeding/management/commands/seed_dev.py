"""Fill a development database with a realistic cast, catalogue and activity.

    python manage.py seed_dev                    # create what is missing
    python manage.py seed_dev --reset            # remove the seeded data, then seed again
    python manage.py seed_dev --list             # print the cast, touch nothing

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

from apps.accounts.models import User
from apps.seeding import reset, runner
from apps.seeding.context import SeedContext
from apps.seeding.data.people import PEOPLE


def cast_table():
    """The people and what to try with each of them."""
    lines = []
    for role in ('admin', 'instructor', 'student'):
        for person in (p for p in PEOPLE if p.role == role):
            lines.append(f'  {role:<10} {person.email:<34} {person.story}')
    return lines


class Command(BaseCommand):
    help = 'Create a realistic development dataset (safe to run repeatedly)'

    def add_arguments(self, parser):
        parser.add_argument('--password',
                            help='password of the seeded users (default: SEED_PASSWORD, else random)')
        parser.add_argument('--reset', action='store_true',
                            help='remove the data this command created before seeding again')
        parser.add_argument('--list', action='store_true', dest='list_cast',
                            help='print the cast and what to try with each account, then stop')
        parser.add_argument('--force', action='store_true',
                            help='allow running with DEBUG=False')

    def handle(self, *args, **options):
        if options['list_cast']:
            self.stdout.write('Seeded accounts (all share one password):')
            for line in cast_table():
                self.stdout.write(line)
            return

        if not settings.DEBUG and not options['force']:
            raise CommandError('Refusing to create demo accounts while DEBUG is off; '
                               'pass --force if this really is a development database.')

        password = options['password'] or settings.SEED_PASSWORD
        generated = not password
        if generated:
            password = secrets.token_urlsafe(12)

        if options['reset']:
            removed = reset.reset()
            self.stdout.write('Removed ' + ', '.join(f'{n} {label}' for label, n in removed.items()))

        existing = User.objects.filter(email__in=[person.email for person in PEOPLE]).count()
        ctx = SeedContext(password=password, stdout=self.stdout)
        with transaction.atomic():
            # the three headline accounts, the plans and two complete courses
            call_command('seed_demo', password=password, stdout=io.StringIO())
            runner.run(ctx)

        self.stdout.write(self.style.SUCCESS('Development data is ready.'))
        self.stdout.write('')
        self.stdout.write('Accounts:')
        for line in cast_table():
            self.stdout.write(line)
        self.stdout.write('')
        if generated:
            self.stdout.write(f'Password of the seeded users: {password}')
        else:
            self.stdout.write('Password of the seeded users: the one you gave (--password / SEED_PASSWORD)')
        if existing:
            self.stdout.write(f'{existing} of these accounts existed before this run and keep their '
                              'old password.')
