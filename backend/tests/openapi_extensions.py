"""How the session authentication of the project appears in the OpenAPI schema.

The entry points (login, signup, refresh, logout) use Unauthenticated, which has no scheme:
they are documented without a security requirement.

Imported by ``test_openapi``: the schema generator is a development tool and is not installed
in production, so these extensions live with the tests.
"""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    """A browser is signed in by the HttpOnly session cookie, anything else by a bearer token."""

    target_class = 'apps.accounts.authentication.CookieJWTAuthentication'
    name = ['sessionCookie', 'bearerToken']

    def get_security_definition(self, auto_schema):
        return [
            {
                'type': 'apiKey',
                'in': 'cookie',
                'name': 'coursera_access',
                'description': 'The HttpOnly access cookie set by login. A write that uses it must also '
                               'send X-Requested-With and an allowed Origin.',
            },
            {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
                'description': 'An access token in the Authorization header (non-browser clients).',
            },
        ]

