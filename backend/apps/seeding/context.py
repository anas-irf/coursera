"""State shared by the steps of one seeding run."""
import random
from collections import Counter
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.utils import timezone


class SeedContext:
    """What every step needs: one clock, one password, the rows created so far.

    ``now`` is fixed for the whole run so that "12 days ago" means the same
    instant everywhere.  ``password_hash`` is computed once and shared by every
    seeded user (hashing per user would take seconds each).
    """

    def __init__(self, *, password, stdout, seed='coursera-dev'):
        self.now = timezone.now()
        self.password = password
        self.password_hash = make_password(password)
        self.rng = random.Random(seed)
        self.stdout = stdout

        self.users = {}         # e-mail -> User
        self.categories = {}    # slug   -> Category
        self.languages = {}     # code   -> Language
        self.courses = {}       # slug   -> Course
        self.created = Counter()   # what this run created, by label
        self.fresh_users = set()   # e-mails of users created by this run

    # ------------------------------------------------------------------ time
    def ago(self, days=0, hours=0, minutes=0):
        """The instant ``days`` / ``hours`` / ``minutes`` before the run started."""
        return self.now - timedelta(days=days, hours=hours, minutes=minutes)

    # ---------------------------------------------------------------- output
    def say(self, message=''):
        self.stdout.write(message)

    def count(self, label, amount=1):
        self.created[label] += amount
