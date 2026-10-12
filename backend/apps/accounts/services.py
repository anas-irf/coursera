"""Identity use-cases: token issuing, login bookkeeping, e-mail verification."""
import secrets

from rest_framework_simplejwt.tokens import RefreshToken


def issue_tokens(user):
    """Return a fresh ``{'refresh', 'access'}`` pair carrying the custom claims."""
    refresh = RefreshToken.for_user(user)
    refresh['user_type'] = user.user_type
    refresh['uuid'] = str(user.uuid)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def client_ip(request):
    """Best-effort client address (first X-Forwarded-For hop, else REMOTE_ADDR)."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0]
    return request.META.get('REMOTE_ADDR')


def record_login(user, request):
    """Remember where the user logged in from."""
    user.last_login_ip = client_ip(request)
    user.save(update_fields=['last_login_ip', 'last_login'])


def start_email_verification(user):
    """Attach a new verification token to the user and return it.

    Sending the e-mail itself is not implemented yet.
    """
    user.email_verification_token = secrets.token_urlsafe(32)
    user.save(update_fields=['email_verification_token'])
    return user.email_verification_token


def verify_email(token):
    """Mark the user owning ``token`` as verified; return the user or ``None``."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        user = User.objects.get(email_verification_token=token)
    except User.DoesNotExist:
        return None
    user.email_verified = True
    user.email_verification_token = None
    user.save(update_fields=['email_verified', 'email_verification_token'])
    return user
