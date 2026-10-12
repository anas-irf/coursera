# insights/api/directory.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin

from .. import directory


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_all_users(request):
    """Get all users for admin dashboard"""
    return Response(directory.user_directory())
