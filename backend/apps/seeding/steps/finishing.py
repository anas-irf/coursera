"""The last step: what ends the stories and the numbers that depend on all of them.

* deadlines are applied after the hand-ins (a past deadline would have refused
  them) and the late flag is recomputed from the actual dates;
* a course is taken offline once its learners have enrolled;
* showcase courses get the popularity the catalogue shows;
* subscriptions move to their final state;
* the streak field of each student follows the activity that exists.
"""
from datetime import timedelta

from apps.assessments.models import Assignment as AssignmentModel
from apps.assessments.models import AssignmentSubmission
from apps.accounts.models import StudentProfile
from apps.courses.models import Course
from apps.courses.services import lifecycle
from apps.insights.student import learning_streak

from ..clock import backdate
from ..data.courses import COURSES, EXTENSIONS
from ..data.people import EMAILS
from ..data.spec import Assignment
from . import subscriptions

TITLE = 'Deadlines, offline courses, popularity and subscriptions'
OFFLINE_DAYS = 15


def run(ctx):
    _deadlines(ctx)
    _take_offline(ctx)
    _popularity(ctx)
    subscriptions.settle(ctx)
    _streaks(ctx)


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


def _streaks(ctx):
    for profile in StudentProfile.objects.filter(user__email__in=EMAILS).select_related('user'):
        streak = learning_streak(profile.user)
        if profile.learning_streak != streak:
            StudentProfile.objects.filter(pk=profile.pk).update(learning_streak=streak)
