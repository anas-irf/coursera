"""The ordered steps of ``seed_dev``.

Every step is a module in ``apps.seeding.steps`` with a ``TITLE`` and a
``run(ctx)`` that only creates what is missing, so the whole run can be
repeated.  The order matters: content before enrolments, subscriptions before
Plus enrolments, activity before the transitions that end it.
"""
from .steps import STEPS


def run(ctx):
    for step in STEPS:
        ctx.say(f'-- {step.TITLE}')
        step.run(ctx)
