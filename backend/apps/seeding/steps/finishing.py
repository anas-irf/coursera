"""The last step: what ends the stories and the numbers that depend on all of them.

* deadlines are applied after the hand-ins (a past deadline would have refused
  them) and the late flag is recomputed from the actual dates;
* a course is taken offline once its learners have enrolled;
* showcase courses get the popularity the catalogue shows;
* subscriptions move to their final state;
* the learning log of each student is topped up to the hours their story tells, and the
  streak and hours of their profile follow it.
"""
from datetime import timedelta

from django.db.models import F
from django.utils import timezone

from apps.assessments.models import Assignment as AssignmentModel
from apps.assessments.models import AssignmentSubmission
from apps.courses.models import Course
from apps.courses.services import lifecycle
from apps.learning import selectors as learning_selectors
from apps.learning import services as learning
from apps.learning.models import LearningStreak

from ..clock import backdate
from ..data.courses import COURSES, EXTENSIONS
from ..data.people import PEOPLE
from ..data.spec import Assignment
from . import subscriptions

TITLE = 'Deadlines, offline courses, popularity and subscriptions'
OFFLINE_DAYS = 15


def run(ctx):
    _deadlines(ctx)
    _take_offline(ctx)
    _popularity(ctx)
    subscriptions.settle(ctx)
    _learning_log(ctx)


def _deadlines(ctx):
    """Set the due dates once; ``is_late`` follows from when each hand-in happened."""
    changed = 0
    for spec in COURSES:
        for section in spec.sections:
            for item in section.items:
                if not isinstance(item, Assignment) or item.due is None:
                    continue
                assignment = AssignmentModel.objects.filter(course__slug=spec.slug, title=item.title).first()
                if assignment is None or assignment.due_date is not None:
                    continue
                due = ctx.now + timedelta(days=item.due)
                backdate(assignment, due_date=due)
                for submission in AssignmentSubmission.objects.filter(assignment=assignment):
                    late = submission.submitted_at > due
                    if submission.is_late != late:
                        AssignmentSubmission.objects.filter(pk=submission.pk).update(is_late=late)
                changed += 1
    ctx.say(f'   {changed} deadlines set')


def _take_offline(ctx):
    for spec in COURSES:
        if spec.state != 'taken_offline':
            continue
        course = Course.objects.get(slug=spec.slug)
        if course.status == 'published':
            lifecycle.unpublish(course)
            backdate(course, updated_at=ctx.ago(OFFLINE_DAYS))
            ctx.say(f'   {spec.slug} taken offline with its learners still enrolled')


def _popularity(ctx):
    counters = {spec.slug: spec.popularity for spec in COURSES if spec.popularity}
    counters.update({slug: ext['popularity'] for slug, ext in EXTENSIONS.items() if ext['popularity']})
    for slug, popularity in counters.items():
        course = Course.objects.filter(slug=slug).first()
        if course is not None and course.total_enrolled < popularity:
            backdate(course, total_enrolled=popularity)


def _learning_log(ctx):
    """Close the learning log.

    A student's story says how many hours they have learned; the enrolments account for part
    of it and the rest is learning that no seeded course explains.  That rest is written as one
    evening every third day, so the monthly chart and the rank have a history to show.
    """
    for person in PEOPLE:
        if person.role != 'student':
            continue
        student = ctx.users[person.email]

        missing = int(person.hours * 3600) - learning_selectors.total_seconds(student)
        if missing > 0:
            days = list(range(1, max(1, min(person.joined, 60)) + 1, 3))
            share, rest = divmod(missing, len(days))
            for position, offset in enumerate(days):
                entry, _ = LearningStreak.objects.get_or_create(
                    student=student, streak_date=timezone.localdate(ctx.ago(days=offset)))
                LearningStreak.objects.filter(pk=entry.pk).update(
                    seconds_learned=F('seconds_learned') + share + (rest if position == 0 else 0))

        learning.sync_profile_totals(student)
