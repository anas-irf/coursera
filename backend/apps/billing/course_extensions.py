"""How billing extends the courses slice (registered from ``BillingConfig.ready``)."""
from django.db.models import Sum

from apps.courses import extensions

from .models import InstructorEarning


def course_revenue(course):
    """Extra column of the instructor's course list: revenue earned by the course."""
    revenue = InstructorEarning.objects.filter(
        course=course
    ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
    return {'total_revenue': float(revenue)}


def register():
    extensions.register_course_row_enricher(course_revenue)
