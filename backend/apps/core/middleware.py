"""
HTTP middleware: extra security headers and a simple in-process rate limiter.
"""
import logging
import time
from collections import defaultdict

from django.http import HttpResponseForbidden
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


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

        # Additional security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Prevent caching of sensitive data
        if request.path.startswith('/api/') and 'gradebook' in request.path:
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        return response


class RateLimitMiddleware(MiddlewareMixin):
    """
    Simple rate limiting middleware
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.request_counts = defaultdict(list)
        self.limits = {
            '/api/accounts/login/': (5, 300),  # 5 requests per 5 minutes
            '/api/accounts/signup/': (3, 300),  # 3 requests per 5 minutes
            '/api/courses/': (100, 60),  # 100 requests per minute
        }

    def __call__(self, request):
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')

        # Check if path should be rate limited
        path = request.path
        for limited_path, (max_requests, window) in self.limits.items():
            if path.startswith(limited_path):
                key = f"{ip}:{limited_path}"
                current_time = time.time()

                # Clean old requests
                self.request_counts[key] = [
                    req_time for req_time in self.request_counts[key]
                    if current_time - req_time < window
                ]

                # Check limit
                if len(self.request_counts[key]) >= max_requests:
                    logger.warning("Rate limit exceeded for %s on %s", ip, path)
                    return HttpResponseForbidden("Rate limit exceeded")

                # Add current request
                self.request_counts[key].append(current_time)

        response = self.get_response(request)
        return response
