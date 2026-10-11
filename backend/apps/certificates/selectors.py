"""Read side of certificates."""
from .models import Certificate


def for_student(student):
    """The certificates a student earned, with the course and its instructor loaded."""
    return Certificate.objects.filter(student=student).select_related(
        'course', 'course__instructor', 'enrollment'
    )
