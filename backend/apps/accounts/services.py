"""Identity use-cases: registration, token issuing, login bookkeeping, profile and password changes, demo sign-in."""
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.api.errors import NotFound, PermissionDenied

from .models import InstructorProfile, StudentProfile, User

# what everybody may change of their own profile, and what only one role has
COMMON_FIELDS = frozenset({'first_name', 'last_name', 'phone_number', 'bio', 'country', 'city'})
ROLE_FIELDS = {
    'instructor': frozenset({'expertise', 'linkedin_url', 'website_url', 'years_of_experience', 'payout_email'}),
    'student': frozenset({'learning_goals', 'interests'}),
}
# the fields that live on the role profile, not on the user
PROFILE_ROW_FIELDS = {
    'instructor': frozenset({'payout_email'}),
    'student': frozenset({'learning_goals', 'interests'}),
}
# a blank link is no link
NULLABLE_LINKS = frozenset({'linkedin_url', 'website_url'})

DEMO_ROLES = ('student', 'instructor', 'admin')


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


def record_login(user, ip_address):
    """Remember when and where the user logged in from."""
    user.last_login = timezone.now()
    user.last_login_ip = ip_address
    user.save(update_fields=['last_login_ip', 'last_login'])


# --------------------------------------------------------------------------- #
# the user's own profile
# --------------------------------------------------------------------------- #
def profile_fields_for(user):
    """The names of the fields ``user`` may change on their profile."""
    return COMMON_FIELDS | ROLE_FIELDS.get(user.user_type, frozenset())


def update_profile(user, changes):
    """Write validated ``changes`` to the user and their role profile, both or neither.

    ``changes`` holds only fields of ``profile_fields_for(user)`` (the serializer drops the rest).
    A role profile that is missing is created on the way, so an old account can fill it in.
    """
    on_profile = PROFILE_ROW_FIELDS.get(user.user_type, frozenset())
    user_changes = {name: value for name, value in changes.items() if name not in on_profile}
    profile_changes = {name: value for name, value in changes.items() if name in on_profile}
    for name in NULLABLE_LINKS & user_changes.keys():
        user_changes[name] = user_changes[name] or None

    with transaction.atomic():
        if user_changes:
            for name, value in user_changes.items():
                setattr(user, name, value)
            user.save(update_fields=sorted(user_changes))
        if profile_changes:
            model = InstructorProfile if user.user_type == 'instructor' else StudentProfile
            profile, _ = model.objects.get_or_create(user=user)
            for name, value in profile_changes.items():
                setattr(profile, name, value)
            profile.save(update_fields=[*sorted(profile_changes), 'updated_at'])
    return user


# --------------------------------------------------------------------------- #
# the password
# --------------------------------------------------------------------------- #
def is_demo_account(user):
    """Whether ``user`` is one of the accounts the demo signs visitors in to (demo mode only)."""
    return bool(settings.DEMO_MODE) and user.email in settings.DEMO_ACCOUNTS.values()


def ensure_password_can_change(user):
    """Refuse a password change of a demo account: every visitor of the demo shares it."""
    if is_demo_account(user):
        raise PermissionDenied('The demo accounts keep their password so that every visitor can use them.',
                               code='demo_account')


def change_password(user, new_password):
    """Set ``new_password`` (already validated) and end every other session of the user.

    Every refresh token issued so far is blacklisted, so another browser or device signed in as
    the user is signed out when its access token runs out; the caller hands the current browser a
    fresh pair (``issue_tokens``).
    """
    ensure_password_can_change(user)
    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=['password'])
        for token in OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True):
            BlacklistedToken.objects.get_or_create(token=token)
    return user


# --------------------------------------------------------------------------- #
# demo sign-in
# --------------------------------------------------------------------------- #
def demo_users():
    """``[(role, user), ...]`` of the demo accounts that exist and may sign in, student first."""
    if not settings.DEMO_MODE:
        return []
    by_email = {user.email: user for user in User.objects.filter(
        email__in=settings.DEMO_ACCOUNTS.values(), is_active=True)}
    return [(role, by_email[email]) for role in DEMO_ROLES
            if (email := settings.DEMO_ACCOUNTS.get(role)) in by_email]


def demo_user(role):
    """The demo account of ``role``; 404 when demo mode is off or the account cannot sign in."""
    for candidate_role, user in demo_users():
        if candidate_role == role:
            return user
    raise NotFound('Demo sign-in is not available.')
