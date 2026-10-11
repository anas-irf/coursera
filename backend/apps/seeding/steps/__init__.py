"""The steps of ``seed_dev`` in the order they run (see ``runner``)."""
from . import catalogue, courses, earnings, engagement, finishing, learning, people, subscriptions

STEPS = (
    people,         # users and profiles
    catalogue,      # categories and languages
    courses,        # curriculum, content, thumbnails, moderation state
    subscriptions,  # Plus subscriptions, active while the students enrol
    learning,       # enrolments, progress, quizzes, hand-ins, grades, bookmarks, certificates
    engagement,     # conversations, extra notifications, read state
    earnings,       # instructor earnings and revenue pools
    finishing,      # deadlines, offline courses, popularity, final subscription states
)
