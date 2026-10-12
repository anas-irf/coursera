"""Extension points of the courses slice.

Slices that sit *above* ``courses`` in the dependency order (content,
assessments, billing, learning) extend what a course can do by registering
behaviour here, normally from their ``AppConfig.ready``.  ``courses`` never
imports them.  Registries are consulted at request time and registration is
idempotent, so re-running ``ready`` is harmless.

Hooks
-----
* ``LectureContentHandler``  - one per ``Lecture.content_type`` (video, reading,
  quiz, assignment): authoring, representations and grade weight;
* course-row enrichers       - extra columns of the instructor's course list;
* lecture enrichers          - extra keys of the instructor's lecture payload;
* delete guards              - reasons why a course must not be deleted.
"""
from decimal import Decimal


class LectureContentHandler:
    """Behaviour of one kind of lecture content (``Lecture.content_type``)."""

    content_type = None

    # --- authoring --------------------------------------------------------- #
    def create(self, lecture, data, files):
        """Create the content rows of a freshly created lecture."""

    def update(self, lecture, data, files):
        """Apply an update request to the content rows of ``lecture``."""

    # --- representations --------------------------------------------------- #
    def instructor_defaults(self):
        """Keys this handler adds to the instructor's lecture payload, with the
        value they carry for lectures of *other* types (every lecture exposes
        the same set of keys)."""
        return {}

    def serialize_for_instructor(self, lecture):
        """The values of those keys for a lecture of this handler's type."""
        return {}

    def serialize_for_student(self, lecture, student):
        """Content specific part of the learner's course player payload."""
        return {}

    def duration(self, lecture):
        """Playing time in seconds (0 for content that has none)."""
        return 0

    def grade_weight(self, course):
        """Share of the final grade this kind of content carries in ``course``."""
        return Decimal('0')


_content_handlers = {}
_course_row_enrichers = []
_lecture_enrichers = []
_delete_guards = []


# --- lecture content --------------------------------------------------------- #
def register_content_handler(handler):
    _content_handlers[handler.content_type] = handler


def get_content_handler(content_type):
    return _content_handlers.get(content_type)


def content_handlers():
    return list(_content_handlers.values())


def instructor_lecture_payload(lecture):
    """Content specific keys of the instructor's view of ``lecture``."""
    payload = {}
    for handler in content_handlers():
        payload.update(handler.instructor_defaults())
    handler = get_content_handler(lecture.content_type)
    if handler is not None:
        payload.update(handler.serialize_for_instructor(lecture))
    return payload


def lecture_duration(lecture):
    handler = get_content_handler(lecture.content_type)
    return handler.duration(lecture) if handler is not None else 0


def total_grade_weight(course):
    """Sum of the grade weights of all graded content of ``course`` (100 = complete)."""
    return sum((h.grade_weight(course) for h in content_handlers()), Decimal('0'))


# --- instructor course list ---------------------------------------------------- #
def register_course_row_enricher(fn):
    """``fn(course) -> dict`` of extra keys for a row of the instructor's course list."""
    if fn not in _course_row_enrichers:
        _course_row_enrichers.append(fn)


def enrich_course_row(course, row):
    for fn in _course_row_enrichers:
        row.update(fn(course) or {})
    return row


# --- lecture payload ----------------------------------------------------------- #
def register_lecture_enricher(fn):
    """``fn(lecture) -> dict`` of extra keys for the instructor's lecture payload."""
    if fn not in _lecture_enrichers:
        _lecture_enrichers.append(fn)


def lecture_extras(lecture):
    extras = {}
    for fn in _lecture_enrichers:
        extras.update(fn(lecture) or {})
    return extras


# --- deleting a course --------------------------------------------------------- #
def register_delete_guard(fn):
    """``fn(course) -> str | None``: a message when the course must not be deleted."""
    if fn not in _delete_guards:
        _delete_guards.append(fn)


def delete_blockers(course):
    messages = []
    for fn in _delete_guards:
        message = fn(course)
        if message:
            messages.append(message)
    return messages
