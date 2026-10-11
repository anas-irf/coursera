"""Every course of the dev catalogue."""
from . import business, data_science, design, programming, web

# the two courses seed_demo creates are only enriched (see programming.EXTENSIONS)
EXTENSIONS = programming.EXTENSIONS

COURSES = (
    programming.COURSES + data_science.COURSES + web.COURSES + design.COURSES + business.COURSES
)
BY_SLUG = {course.slug: course for course in COURSES}
