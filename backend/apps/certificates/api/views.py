"""HTTP adapters of certificates: the learner's list and the public verification page."""

from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.authentication import Unauthenticated
from apps.accounts.permissions import IsStudent
from apps.core.api.errors import NotFound

from .. import selectors


def verification_url(certificate):
    """The page of the React app on which anybody can check the certificate."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify/{certificate.verification_code}"


def _person(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.email


@api_view(['GET'])
@permission_classes([IsStudent])
def student_certificates(request):
    """Get student's earned certificates"""
    return Response([
        {
            'id': str(cert.uuid),
            'course_title': cert.course.title,
            'instructor': f"{cert.course.instructor.first_name} {cert.course.instructor.last_name}",
            'issue_date': cert.issue_date.isoformat(),
            'certificate_id': cert.certificate_number,
            'verification_url': verification_url(cert),
            'grade': float(cert.final_grade) if cert.final_grade else None,
            'thumbnail': cert.course.thumbnail.url if cert.course.thumbnail else None
        }
        for cert in selectors.for_student(request.user)
    ])


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([Unauthenticated])
def verify_certificate(request, code):
    """What anybody holding a verification code may see of the certificate it belongs to.

    The code is random (80 bits), so it cannot be guessed from a student or a course; the answer
    names the learner, the course and the grade, which is what a certificate shows anyway.
    """
    certificate = selectors.by_verification_code(code)
    if certificate is None:
        raise NotFound('No certificate has this verification code.')
    course = certificate.course
    hours = course.estimated_hours or course.duration_hours
    return Response({
        'certificate_number': certificate.certificate_number,
        'verification_code': certificate.verification_code,
        'student_name': _person(certificate.student),
        'course_title': course.title,
        'instructor': _person(course.instructor),
        'issue_date': certificate.issue_date.isoformat(),
        'grade': float(certificate.final_grade) if certificate.final_grade is not None else None,
        'course_hours': float(hours) if hours else None,
    })
