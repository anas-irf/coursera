"""Read side of certificates."""
from .models import Certificate


def for_student(student):
    """The certificates a student earned, with the course and its instructor loaded."""
    return Certificate.objects.filter(student=student).select_related(
        'course', 'course__instructor', 'enrollment'
    )


def by_verification_code(code):
    """The certificate a verification code belongs to (``None`` for an unknown code)."""
    return (
        Certificate.objects
        .filter(verification_code=code)
        .select_related('student', 'course', 'course__instructor')
        .first()
    )
