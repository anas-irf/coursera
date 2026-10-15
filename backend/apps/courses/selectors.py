"""Read side of the courses slice: what an instructor or an admin may look at.

Views take a queryset from here and look an object up in it (``get_object_or_404``), so the
ownership rule is written once and a course that is not yours is a 404, not a 403.
"""
from django.db.models import Count

from apps.core.models import Category, Language

from .models import Course, Lecture, Section


def instructor_courses(instructor):
    """The courses an instructor owns."""
    return Course.objects.filter(instructor=instructor)


def instructor_sections(instructor, course_uuid=None):
    """The sections of the instructor's courses, of one course when ``course_uuid`` is given."""
    sections = Section.objects.filter(course__instructor=instructor)
    return sections.filter(course__uuid=course_uuid) if course_uuid else sections


def instructor_lectures(instructor, section_uuid=None):
    """The lectures of the instructor's courses, of one section when ``section_uuid`` is given."""
    lectures = Lecture.objects.filter(section__course__instructor=instructor)
    return lectures.filter(section__uuid=section_uuid) if section_uuid else lectures


def _with_counters(courses):
    return courses.select_related('instructor', 'category').annotate(
        sections_total=Count('sections', distinct=True),
        lectures_total=Count('sections__lectures', distinct=True),
    )


def pending_review():
    """Courses waiting for an admin's decision, the longest waiting first."""
    return _with_counters(Course.objects.filter(status='pending_review')).order_by('-updated_at', 'id')


def all_courses():
    """Every course, newest first (the admin's overview)."""
    return _with_counters(Course.objects.all()).order_by('-created_at', 'id')


def active_categories():
    """Categories a course can be filed under."""
    return Category.objects.filter(is_active=True).order_by('name')


def languages():
    """Languages a course can be taught in."""
    return Language.objects.order_by('name')
