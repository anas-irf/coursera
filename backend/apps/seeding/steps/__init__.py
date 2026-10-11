"""The steps of ``seed_dev`` in the order they run (see ``runner``)."""
from . import catalogue, courses, learning, people, subscriptions

STEPS = (
    people,         # users and profiles
    catalogue,      # categories and languages
    courses,        # curriculum, content, thumbnails, moderation state
    subscriptions,  # Plus subscriptions, active while the students enrol
    learning,       # enrolments, progress, quizzes, hand-ins, grades, bookmarks, certificates
)
