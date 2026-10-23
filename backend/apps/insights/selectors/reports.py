"""The administrator's reports: whole tables of the platform, as rows for a CSV download.

A report is a header and an iterator of plain values (text, numbers, ISO dates); the HTTP adapter
writes it as CSV.  Every report reads the live data at the moment it is downloaded.
"""
from django.db.models import Count

from apps.accounts.models import User
from apps.billing.models import InstructorEarning, StudentPlusPayment
from apps.certificates.models import Certificate
from apps.courses.models import Course
from apps.learning.models import Enrollment


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.email


def _when(moment):
    return moment.isoformat() if moment else ''


def _users():
    return User.objects.order_by('-date_joined', 'id')


def _user_rows(users):
    for user in users:
        yield (str(user.uuid), _name(user), user.email, user.user_type, 'active' if user.is_active else 'inactive',
               'yes' if user.email_verified else 'no', _when(user.date_joined), _when(user.last_login),
               user.country, user.city)


def _courses():
    return (Course.objects.select_related('instructor', 'category')
            .annotate(n_enrollments=Count('enrollments')).order_by('-created_at', 'id'))


def _course_rows(courses):
    for course in courses:
        yield (str(course.uuid), course.title, _name(course.instructor), course.instructor.email, course.status,
               course.course_type, course.category.name if course.category else '', course.level,
               course.n_enrollments, float(course.average_rating), course.total_reviews,
               _when(course.published_date), _when(course.created_at))


def _enrollments():
    return Enrollment.objects.select_related('student', 'course').order_by('-enrolled_date', 'id')


def _enrollment_rows(enrollments):
    for row in enrollments:
        yield (str(row.uuid), _name(row.student), row.student.email, row.course.title, row.status,
               float(row.progress_percentage), _when(row.enrolled_date), _when(row.completed_date),
               _when(row.last_accessed), 'yes' if row.certificate_issued else 'no')


def _payments():
    return StudentPlusPayment.objects.select_related('subscription__student').order_by('-payment_date', 'id')


def _payment_rows(payments):
    for payment in payments:
        student = payment.subscription.student
        yield (str(payment.uuid), _name(student), student.email, payment.subscription.subscription_type,
               float(payment.amount), payment.currency, payment.status, _when(payment.payment_date),
               payment.transaction_id or '')


def _earnings():
    return InstructorEarning.objects.select_related('instructor', 'course').order_by('-month', 'id')


def _earning_rows(earnings):
    for row in earnings:
        yield (str(row.uuid), row.month.strftime('%Y-%m'), _name(row.instructor), row.course.title,
               row.enrollments_count, row.completions_count, float(row.engagement_score),
               float(row.performance_multiplier), float(row.final_amount), 'paid' if row.is_paid else 'pending')


def _certificates():
    return Certificate.objects.select_related('student', 'course').order_by('-issue_date', 'id')


def _certificate_rows(certificates):
    for row in certificates:
        yield (row.certificate_number, _name(row.student), row.student.email, row.course.title,
               _when(row.issue_date), float(row.final_grade) if row.final_grade is not None else '',
               row.verification_code)


# id -> (name, description, columns, queryset, rows)
REPORTS = {
    'users': (
        'Users', 'Every account with its role, status and when it signed up and last signed in.',
        ('id', 'name', 'email', 'role', 'status', 'email_verified', 'date_joined', 'last_login', 'country',
         'city'),
        _users, _user_rows),
    'courses': (
        'Courses', 'Every course with its instructor, moderation status, enrolments and rating.',
        ('id', 'title', 'instructor', 'instructor_email', 'status', 'type', 'category', 'level', 'enrollments',
         'rating', 'reviews', 'published', 'created'),
        _courses, _course_rows),
    'enrollments': (
        'Enrollments', 'Every enrolment with the progress of the learner and whether it earned a certificate.',
        ('id', 'student', 'student_email', 'course', 'status', 'progress', 'enrolled', 'completed',
         'last_accessed', 'certificate'),
        _enrollments, _enrollment_rows),
    'payments': (
        'Plus payments', 'Every Coursera Plus payment, completed or failed, with its plan and amount.',
        ('id', 'student', 'email', 'plan', 'amount', 'currency', 'status', 'date', 'transaction_id'),
        _payments, _payment_rows),
    'earnings': (
        'Instructor earnings', "The instructors' share of the Plus revenue, per course and month.",
        ('id', 'month', 'instructor', 'course', 'enrollments', 'completions', 'engagement', 'multiplier',
         'amount', 'status'),
        _earnings, _earning_rows),
    'certificates': (
        'Certificates', 'Every certificate issued, with its grade and the code that verifies it.',
        ('number', 'student', 'student_email', 'course', 'issued', 'grade', 'verification_code'),
        _certificates, _certificate_rows),
}


def available():
    """The reports an administrator can download, with how many rows each has now."""
    return [
        {'id': report_id, 'name': name, 'description': description, 'rows': queryset().count()}
        for report_id, (name, description, _columns, queryset, _rows) in REPORTS.items()
    ]


def table(report_id):
    """``(columns, rows)`` of a report, ``None`` for an id that is not a report."""
    entry = REPORTS.get(report_id)
    if entry is None:
        return None
    _name_, _description, columns, queryset, rows = entry
    return columns, rows(queryset().iterator())
