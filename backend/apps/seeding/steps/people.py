"""People: the users of every role with their profiles."""
from apps.accounts.models import InstructorProfile, StudentProfile, User

from ..data.people import PEOPLE

TITLE = 'People'


def run(ctx):
    created = 0
    for person in PEOPLE:
        user = User.objects.filter(email=person.email).first()
        if user is None:
            user = _create(ctx, person)
            ctx.fresh_users.add(person.email)
            created += 1
        elif not user.bio:
            # a headline account made by seed_demo: add the details once
            _describe(ctx, user, person)
        _profile(ctx, user, person)
        ctx.users[person.email] = user

    ctx.count('users', created)
    ctx.say(f'   {created} created, {len(PEOPLE) - created} already there')


def _create(ctx, person):
    user = User(
        username=person.email,
        email=person.email,
        password=ctx.password_hash,
        user_type=person.role,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=person.active,
        email_verified=person.verified,
        is_staff=person.role == 'admin',
        is_superuser=person.superuser,
        bio=person.bio,
        country=person.country,
        city=person.city,
        expertise=person.expertise,
        years_of_experience=person.years,
        date_joined=ctx.ago(person.joined),
        last_login=ctx.ago(person.login) if person.login is not None else None,
    )
    user.save()
    return user


def _describe(ctx, user, person):
    """Give an account that already exists the details of its persona."""
    user.bio = person.bio
    user.country = person.country
    user.city = person.city
    user.expertise = person.expertise
    user.years_of_experience = person.years
    user.date_joined = ctx.ago(person.joined)
    user.last_login = ctx.ago(person.login) if person.login is not None else None
    user.save(update_fields=['bio', 'country', 'city', 'expertise', 'years_of_experience',
                             'date_joined', 'last_login'])


def _profile(ctx, user, person):
    if person.role == 'instructor':
        profile, _ = InstructorProfile.objects.get_or_create(user=user)
        if person.verified_instructor and not profile.verified_instructor:
            profile.verified_instructor = True
            profile.save(update_fields=['verified_instructor', 'updated_at'])
    elif person.role == 'student':
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        if not profile.learning_goals:
            # hours, streak and the last day of learning come from the log (see ``finishing``)
            profile.learning_goals = person.goals
            profile.interests = list(person.interests)
            profile.save()
