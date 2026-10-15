"""System checks for the session cookie settings (``manage.py check``, and ``--deploy``)."""
from django.conf import settings
from django.core.checks import Error, Tags, Warning, register  # noqa: A004


@register(Tags.security)
def session_cookie_settings(app_configs, **kwargs):
    errors = []
    samesite = str(settings.AUTH_COOKIE_SAMESITE).capitalize()

    if samesite not in ('Lax', 'Strict', 'None'):
        errors.append(Error(
            f'AUTH_COOKIE_SAMESITE must be Lax, Strict or None, not {settings.AUTH_COOKIE_SAMESITE!r}.',
            id='accounts.E001'))
    if samesite == 'None' and not settings.AUTH_COOKIE_SECURE:
        errors.append(Error(
            'AUTH_COOKIE_SAMESITE=None is only accepted by browsers together with AUTH_COOKIE_SECURE=True.',
            id='accounts.E002'))
    if settings.CORS_ALLOW_ALL_ORIGINS and settings.CORS_ALLOW_CREDENTIALS:
        errors.append(Error(
            'CORS_ALLOW_ALL_ORIGINS with credentials lets any site act for a signed-in user.',
            hint='List the origin of the app in CORS_ALLOWED_ORIGINS instead.',
            id='accounts.E003'))
    return errors


@register(Tags.security, deploy=True)
def session_cookies_are_secure_in_deployment(app_configs, **kwargs):
    if settings.AUTH_COOKIE_SECURE:
        return []
    return [Warning(
        'The session cookies are not marked Secure.',
        hint='Set AUTH_COOKIE_SECURE=True (production settings do).',
        id='accounts.W001')]
