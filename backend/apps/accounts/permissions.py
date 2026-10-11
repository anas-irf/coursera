# accounts/permissions.py
from rest_framework import permissions

class IsInstructor(permissions.BasePermission):
    """
    Custom permission to only allow instructors to access certain views.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'instructor'

class IsStudent(permissions.BasePermission):
    """
    Custom permission to only allow students to access certain views.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.user_type == 'student'

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner
        return obj.instructor == request.user