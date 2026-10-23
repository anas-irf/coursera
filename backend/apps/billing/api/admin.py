"""HTTP adapters of the administrator's plan settings: the Coursera Plus plans and their prices."""
from decimal import Decimal

from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from apps.core.api.errors import NotFound
from apps.core.api.params import object_body

from .. import plans, selectors
from ..services import pricing


class PlanChangeSerializer(serializers.Serializer):
    """What an administrator may change of a plan."""
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=500, allow_blank=True)
    price = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=Decimal('0.01'),
                                     max_value=Decimal('9999.99'))


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_plans(request):
    """The monthly and the yearly plan, as sold now."""
    return Response(selectors.admin_plans())


@api_view(['PUT'])
@permission_classes([IsAdmin])
def admin_plan(request, cycle):
    """Change the name, wording or price of the plan of a billing cycle (new checkouts only)."""
    if cycle not in plans.CYCLES:
        raise NotFound('There is no such plan.')
    serializer = PlanChangeSerializer(data=object_body(request))
    serializer.is_valid(raise_exception=True)
    pricing.update_plan(cycle, **serializer.validated_data)
    return Response(next(row for row in selectors.admin_plans() if row['cycle'] == cycle))
