from rest_framework import permissions
from .models import User

class IsAdmin(permissions.BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Roles.ADMIN)

class IsManager(permissions.BasePermission):
    """Allows access only to Manager users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Roles.MANAGER)

class IsEmployee(permissions.BasePermission):
    """Allows access only to Employee users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Roles.EMPLOYEE)

class CanAssignTask(permissions.BasePermission):
    """
    Object-level assignment permission:
    - Admin: can assign to anyone
    - Manager: can assign ONLY to Employee
    - Employee: forbidden
    Note: The view must manually pass the target user role for validation on create/assign endpoints, 
    or we can handle the logic directly inside the view's perform_create/update.
    """
    def has_permission(self, request, view):
        # Employees cannot assign or reassign tasks
        if request.user.role == User.Roles.EMPLOYEE:
            return False
        return True
