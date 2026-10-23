"""HTTP adapters of the administrator's revenue page, reports and platform overview."""
import csv

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from apps.core.api.errors import NotFound, ServiceError
from apps.core.api.params import int_param

from ..selectors import finance, platform, reports

# a cell a spreadsheet would run as a formula is written as text (CSV injection)
FORMULA_STARTS = ('=', '+', '-', '@', '\t', '\r')


def csv_cell(value):
    """``value`` as it may safely go into a CSV that someone opens in a spreadsheet."""
    if isinstance(value, str) and value.startswith(FORMULA_STARTS):
        return f"'{value}"
    return value


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_revenue(request):
    """Plus revenue by month, the members, the instructors' share and the latest payments."""
    months = int_param(request, 'months', finance.PERIODS[0])
    if months not in finance.PERIODS:
        raise ServiceError(f'months must be one of {", ".join(map(str, finance.PERIODS))}')
    return Response(finance.revenue(months))


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_reports(request):
    """The reports that can be downloaded, with their current number of rows."""
    return Response(reports.available())


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_report(request, report):
    """One report as a CSV file, read from the live data."""
    result = reports.table(report)
    if result is None:
        raise NotFound('There is no report with this name.')
    columns, rows = result

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    filename = f'{report}-{timezone.localdate().isoformat()}.csv'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([csv_cell(value) for value in row])
    return response


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_platform(request):
    """The rules the platform runs by, its categories and languages, and what this instance runs on."""
    return Response(platform.overview())
