"""HTTP adapters of the administrator's user directory."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin

from ..selectors import directory


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_users(request):
    """Get all users for admin dashboard"""
    return Response(directory.user_directory())
