"""Identity use-cases: token issuing and login bookkeeping."""
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

