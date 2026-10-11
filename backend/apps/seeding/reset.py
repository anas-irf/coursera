"""Undo ``seed_dev``: remove the seeded people and everything that hangs off them.

Only the e-mail addresses listed in ``data/people.py`` are touched.  Their
courses go with them (so do the enrolments of anybody in those courses), and
so do the notifications that point at those courses and enrolments and the
files that were uploaded.  Reference data (categories, languages, plans) stays.
"""
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q

from apps.accounts.models import User
from apps.assessments.models import AssignmentSubmission
from apps.certificates.models import Certificate
from apps.courses.models import Course
from apps.learning.models import Enrollment
from apps.notifications.models import Notification

from .data.people import EMAILS


@transaction.atomic
def reset():
    """Delete the seeded rows; returns ``{'users': n, 'courses': n, ...}``."""
    users = User.objects.filter(email__in=EMAILS)
    courses = Course.objects.filter(instructor__in=users)
    enrollments = Enrollment.objects.filter(Q(student__in=users) | Q(course__in=courses))

    # notifications point at their subject through a content type and a uuid, so
    # no foreign key removes them with the course
    subjects = [str(uuid) for queryset in (
        courses.values_list('uuid', flat=True),
        enrollments.values_list('uuid', flat=True),
        Certificate.objects.filter(enrollment__in=enrollments).values_list('uuid', flat=True),
    ) for uuid in queryset]
    notifications = Notification.objects.filter(object_id__in=subjects).count()
    Notification.objects.filter(object_id__in=subjects).delete()

    files = list(courses.exclude(thumbnail='').values_list('thumbnail', flat=True))
    files += list(AssignmentSubmission.objects
                  .filter(Q(student__in=users) | Q(assignment__course__in=courses))
                  .exclude(submission_file='').values_list('submission_file', flat=True))

    counts = {'users': users.count(), 'courses': courses.count(), 'enrolments': enrollments.count(),
              'notifications': notifications, 'files': len(files)}
    users.delete()      # cascades: profiles, courses, enrolments, attempts, messages, ...

    for name in files:
        default_storage.delete(name)
    return counts
