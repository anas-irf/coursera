"""How learning extends the courses slice (registered from ``LearningConfig.ready``)."""
from apps.courses import extensions

from .models import Enrollment, LectureProgress


def lecture_completion(lecture):
    """Extra key of the instructor's lecture payload: % of learners that completed it."""
    total = LectureProgress.objects.filter(lecture=lecture).count()
    completed = LectureProgress.objects.filter(lecture=lecture, is_completed=True).count()
    return {'completion_rate': (completed / total * 100) if total > 0 else 0}


def enrollment_guard(course):
    """A course that has learners must not be deleted."""
    enrollment_count = Enrollment.objects.filter(course=course).count()
    if enrollment_count > 0:
        return (f'Cannot delete course with {enrollment_count} enrolled students. '
                f'Please contact support for assistance.')
    return None


def register():
    extensions.register_lecture_enricher(lecture_completion)
    extensions.register_delete_guard(enrollment_guard)
