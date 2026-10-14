"""Identity use-cases: registration, token issuing and login bookkeeping."""
from django.db import transaction
from rest_framework.throttling import BaseThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import InstructorProfile, StudentProfile, User


def register(*, email, password, user_type='student', first_name='', last_name='', phone_number=''):
    """Create the account together with its role profile; both exist or neither does."""
    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            username=email,  # the e-mail address is the username
            password=password,
            user_type=user_type,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
        )
        profile = InstructorProfile if user_type == 'instructor' else StudentProfile
        profile.objects.create(user=user)
    return user


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
    """The client address as the throttles see it: ``REMOTE_ADDR``, or the right hop of
    ``X-Forwarded-For`` when ``NUM_PROXIES`` says that proxies sit in front of the app."""
    return BaseThrottle().get_ident(request)


def record_login(user, request):
    """Remember where the user logged in from."""
    user.last_login_ip = client_ip(request)
    user.save(update_fields=['last_login_ip', 'last_login'])

