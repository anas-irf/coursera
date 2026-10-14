"""API error handling shared by every slice.

``ServiceError`` is raised by service functions for expected failures; the
exception handler turns it into the ``{"error": ...}`` payload the frontend
already understands.  DRF's own exceptions (validation, authentication, 404 ...)
keep their documented shapes.

Anything else is a bug: the traceback goes to the log and the client gets the
same stable answer whatever went wrong, never the exception text (see
``tests/test_error_exposure.py``).  Views therefore do not wrap their bodies in
``except Exception``.
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

SERVER_ERROR = {
    'error': 'Something went wrong on our side. Please try again later.',
    'code': 'server_error',
}


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
    """DRF ``EXCEPTION_HANDLER``: map ServiceError, keep DRF's shapes, answer a bug with a 500."""
    if isinstance(exc, ServiceError):
        return Response(exc.as_payload(), status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    view = context.get('view')
    request = context.get('request')
    logger.error(
        'Unhandled %s in %s (%s %s)', type(exc).__name__,
        type(view).__name__ if view is not None else '?',
        getattr(request, 'method', '?'), getattr(request, 'path', '?'),
        exc_info=exc,
    )
    return Response(dict(SERVER_ERROR), status=status.HTTP_500_INTERNAL_SERVER_ERROR)
