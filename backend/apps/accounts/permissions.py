"""Role based permission classes - the single definition used by every slice."""
from rest_framework.permissions import IsAuthenticated


class IsStudent(IsAuthenticated):
    """Authenticated users whose ``user_type`` is ``student``."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.user_type == 'student'


class IsInstructor(IsAuthenticated):
    """Authenticated users whose ``user_type`` is ``instructor``."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.user_type == 'instructor'


class IsAdmin(IsAuthenticated):
    """Platform administrators (``user_type == 'admin'`` or a Django superuser)."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_admin
