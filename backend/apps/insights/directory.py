"""User directory for administrators."""
from django.db.models import Count, Q

from apps.accounts.models import User


def user_directory():
    """Every user with the figures that matter for their role (newest first)."""
    users = User.objects.annotate(
        n_enrolled=Count('enrollments', distinct=True),
        n_completed=Count('enrollments', filter=Q(enrollments__status='completed'), distinct=True),
        n_active=Count('enrollments', filter=Q(enrollments__status='active'), distinct=True),
        n_created=Count('courses_created', distinct=True),
        n_published=Count('courses_created', filter=Q(courses_created__status='published'),
                          distinct=True),
        n_draft=Count('courses_created', filter=Q(courses_created__status='draft'), distinct=True),
        n_taught=Count('courses_created__enrollments__student', distinct=True),
    ).order_by('-date_joined')

    rows = []
    for user in users:
        row = {
            'id': str(user.uuid),
            'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split('@')[0],
            'email': user.email,
            'user_type': user.user_type,
            'join_date': user.date_joined.isoformat(),
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'is_active': user.is_active,
            'status': 'active' if user.is_active else 'inactive',
            'phone_number': getattr(user, 'phone_number', '') or '',
            'email_verified': getattr(user, 'email_verified', False),
            'avatar': f'https://ui-avatars.com/api/?name={user.first_name or "User"}&background=6366F1&color=fff'
        }

        if user.user_type == 'student':
            row.update({
                'courses_enrolled': user.n_enrolled,
                'completed_courses': user.n_completed,
                'active_courses': user.n_active,
            })
        elif user.user_type == 'instructor':
            row.update({
                'courses_created': user.n_created,
                'published_courses': user.n_published,
                'draft_courses': user.n_draft,
                'students_taught': user.n_taught,
            })
        else:  # administrators
            row.update({
                'is_superuser': getattr(user, 'is_superuser', False),
                'is_admin': getattr(user, 'is_admin', False),
            })

        rows.append(row)
    return rows
