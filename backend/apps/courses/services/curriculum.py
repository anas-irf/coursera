"""Sections and lectures of a course: the rules of editing, ordering and removing them.

A published course is not edited in place: the instructor unpublishes it first, so what
students are taking never changes under them.  ``ensure_editable`` is that rule, and every
change below starts with it.
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max

from apps.core.api.errors import ServiceError

from .. import extensions
from ..models import Lecture, Section


def ensure_editable(course, doing):
    """Refuse a change to a published course; ``doing`` completes "Cannot ... published courses"."""
    if course.status == 'published':
        raise ServiceError(
            f'Cannot {doing} published courses. Please unpublish the course first.',
            course_status=course.status,
        )


def next_order(queryset):
    """Order value for a new item appended to ``queryset`` (max + 1)."""
    return (queryset.aggregate(top=Max('order'))['top'] or 0) + 1


def resequence(queryset):
    """Renumber the items of ``queryset`` 1..n, keeping their relative order."""
    for position, obj in enumerate(queryset.order_by('order'), 1):
        if obj.order != position:
            obj.order = position
            obj.save()


def reorder(queryset, orders):
    """Apply ``[{'uuid': ..., 'order': ...}, ...]`` to the items of ``queryset``.

    Unknown (or malformed) uuids are skipped; a payload that is not a list of
    objects with an integer ``order`` is a 400.  Orders are unique per parent, so
    every item is first parked on a temporary high value before the final values
    are set.
    """
    if not isinstance(orders, list) or not all(isinstance(item, dict) for item in orders):
        raise ServiceError('The orders must be a list of {uuid, order} objects')
    for item in orders:
        if isinstance(item.get('order'), bool) or not isinstance(item.get('order'), int):
            raise ServiceError('Every order must be a whole number')

    with transaction.atomic():
        to_update = []
        for item in orders:
            try:
                obj = queryset.get(uuid=item.get('uuid'))
            except (queryset.model.DoesNotExist, ValidationError, ValueError):
                continue
            to_update.append((obj, item['order']))

        # Step 1: temporary high values (1000+)
        for index, (obj, _new_order) in enumerate(to_update):
            obj.order = 1000 + index
            obj.save()

        # Step 2: the final values
        for obj, new_order in to_update:
            obj.order = new_order
            obj.save()


# --------------------------------------------------------------------------- #
# sections
# --------------------------------------------------------------------------- #
def add_section(course, fields):
    """Append a section to ``course``; the position is the next free one whatever ``fields`` say."""
    ensure_editable(course, 'add sections to')
    order = next_order(Section.objects.filter(course=course))
    return Section.objects.create(**{**fields, 'course': course, 'order': order})


def edit_section(section, fields):
    ensure_editable(section.course, 'edit sections of')
    for name, value in fields.items():
        setattr(section, name, value)
    section.save()
    return section


def delete_section(section):
    """Delete a section and renumber the remaining ones 1..n."""
    ensure_editable(section.course, 'delete sections of')
    course = section.course
    with transaction.atomic():
        section.delete()
        resequence(Section.objects.filter(course=course))


def reorder_sections(course, orders):
    ensure_editable(course, 'reorder sections of')
    reorder(Section.objects.filter(course=course), orders)


# --------------------------------------------------------------------------- #
# lectures
# --------------------------------------------------------------------------- #
def add_lecture(section, fields, data, files):
    """Append a lecture to ``section`` together with the content its type owns.

    The lecture and its content are one write: a content that is refused (a file of the wrong
    type, a length that is not a number) leaves no lecture behind.
    """
    ensure_editable(section.course, 'add lectures to')
    order = next_order(Lecture.objects.filter(section=section))

    with transaction.atomic():
        lecture = Lecture.objects.create(**{**fields, 'section': section, 'order': order})
        handler = extensions.get_content_handler(lecture.content_type)
        if handler is not None:
            handler.create(lecture, data, files)
    return lecture


def edit_lecture(lecture, fields, data, files):
    """Change a lecture and its content in one write."""
    ensure_editable(lecture.section.course, 'edit lectures of')

    with transaction.atomic():
        for name, value in fields.items():
            setattr(lecture, name, value)
        lecture.save()
        handler = extensions.get_content_handler(lecture.content_type)
        if handler is not None:
            handler.update(lecture, data, files)
    return lecture


def delete_lecture(lecture):
    """Delete a lecture and renumber the remaining ones 1..n."""
    ensure_editable(lecture.section.course, 'delete lectures of')
    section = lecture.section
    with transaction.atomic():
        lecture.delete()
        resequence(Lecture.objects.filter(section=section))


def reorder_lectures(section, orders):
    ensure_editable(section.course, 'reorder lectures of')
    reorder(Lecture.objects.filter(section=section), orders)
