"""The steps of ``seed_dev`` in the order they run (see ``runner``)."""
from . import catalogue, courses, people

STEPS = (
    people,         # users and profiles
    catalogue,      # categories and languages
    courses,        # curriculum, content, thumbnails, moderation state
)
