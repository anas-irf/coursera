"""
HTTP middleware: security headers and the marking of the deprecated API paths.
"""
import logging

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class LegacyApiMiddleware(MiddlewareMixin):
    """Marks the answers of the unversioned ``/api/<slice>/`` aliases as deprecated.

    The aliases reach the very same views as ``/api/v1/<slice>/``.  A client sees
    ``Deprecation: true``, a ``Link`` to the versioned path and, when
    ``API_LEGACY_SUNSET`` names a date, ``Sunset``.  Every use is logged, so the
    day the aliases can be switched off is chosen from data.
    """

    def process_response(self, request, response):
        match = getattr(request, 'resolver_match', None)
        if match is None or 'legacy' not in match.namespaces:
            return response

        response['Deprecation'] = 'true'
        successor = f'</api/v1/{request.path[len("/api/"):]}>; rel="successor-version"'
        # a paginated list already carries Link: rel="next" | "prev"
        response['Link'] = f'{response["Link"]}, {successor}' if response.has_header('Link') else successor
        if settings.API_LEGACY_SUNSET:
            response['Sunset'] = settings.API_LEGACY_SUNSET
        logger.info('Unversioned API path used: %s %s', request.method, request.path)
        return response


class SecurityMiddleware(MiddlewareMixin):
    """
    Custom security middleware to add additional security headers and validations
    """

    def process_response(self, request, response):
        """Add security headers to all responses"""
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.gstatic.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "media-src 'self' blob:; "
            "frame-src 'self' https://www.youtube.com; "
            "connect-src 'self';"
        )
        response['Content-Security-Policy'] = csp

        # nosniff, X-Frame-Options and Referrer-Policy come from Django's own middleware
        # (SECURE_CONTENT_TYPE_NOSNIFF, X_FRAME_OPTIONS, SECURE_REFERRER_POLICY)
        response['X-XSS-Protection'] = '1; mode=block'

        # Prevent caching of sensitive data
        if request.path.startswith('/api/') and 'gradebook' in request.path:
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        return response

