"""API error handling shared by every slice.

``ServiceError`` is raised by service functions for expected failures; the
exception handler turns it into the ``{"error": ...}`` payload the frontend
already understands.  Every other exception is delegated to DRF unchanged, so
existing responses do not change.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ServiceError(Exception):
    """An expected, user-facing failure raised from a service function."""

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message, /, *, status_code=None, **extra):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.extra = extra

    def as_payload(self):
        return {'error': self.message, **self.extra}


class NotFound(ServiceError):
    status_code = status.HTTP_404_NOT_FOUND


class PermissionDenied(ServiceError):
    status_code = status.HTTP_403_FORBIDDEN


def exception_handler(exc, context):
    """DRF ``EXCEPTION_HANDLER``: map ServiceError, delegate everything else."""
    if isinstance(exc, ServiceError):
        return Response(exc.as_payload(), status=exc.status_code)
    return drf_exception_handler(exc, context)
