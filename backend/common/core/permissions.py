from rest_framework import permissions


class IsAuthenticatedAndActive(permissions.IsAuthenticated):
    message = "Your account is not active or not verified."

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            return bool(request.api_key.is_active)
        has_auth = super().has_permission(request, view)
        if not has_auth:
            return False
        user = getattr(request, "user", None)
        if user and hasattr(user, "is_active"):
            return user.is_active and getattr(user, "is_verified", False)
        return True


class HasRole(permissions.BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key_perm = getattr(request.api_key, "permissions", "write")
            if "viewer" in self.allowed_roles:
                return key_perm in ["read", "write", "admin"]
            if "member" in self.allowed_roles:
                return key_perm in ["write", "admin"]
            return key_perm == "admin"

        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        org = getattr(request, "organization", None)
        if not org and hasattr(user, "memberships"):
            membership = user.memberships.filter(is_active=True, organization__is_active=True).first()
            if membership:
                org = membership.organization
                request.organization = org
        qs = user.memberships.filter(
            role__in=self.allowed_roles,
            is_active=True,
            organization__is_active=True,
        )
        if org:
            qs = qs.filter(organization=org)
        return qs.exists()

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsOwner(HasRole):
    allowed_roles = ["owner"]


class IsAdminOrOwner(HasRole):
    allowed_roles = ["owner", "admin"]


class IsOwnerOrReadOnly(HasRole):
    allowed_roles_read = ["owner", "admin", "member", "viewer"]
    allowed_roles_write = ["owner", "admin"]

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key_perm = getattr(request.api_key, "permissions", "write")
            if request.method in permissions.SAFE_METHODS:
                return key_perm in ["read", "write", "admin"]
            return key_perm == "admin"
        if request.method in permissions.SAFE_METHODS:
            user = getattr(request, "user", None)
            if not user or not user.is_authenticated:
                return False
            org = getattr(request, "organization", None)
            if not org and hasattr(user, "memberships"):
                membership = user.memberships.filter(is_active=True, organization__is_active=True).first()
                if membership:
                    org = membership.organization
                    request.organization = org
            qs = user.memberships.filter(
                role__in=self.allowed_roles_read,
                is_active=True,
                organization__is_active=True,
            )
            if org:
                qs = qs.filter(organization=org)
            return qs.exists()
        return super().has_permission(request, view)


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_staff)


class IsOrgOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            return getattr(request.api_key, "permissions", None) == "admin"
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        org = getattr(request, "organization", None)
        if not org:
            membership = user.memberships.filter(role="owner", is_active=True, organization__is_active=True).select_related("organization").first()
            if membership:
                request.organization = membership.organization
                return True
            return False
        return user.memberships.filter(
            organization=org,
            role="owner",
            is_active=True,
            organization__is_active=True,
        ).exists()


class CanManageMembers(HasRole):
    allowed_roles = ["owner", "admin"]


class CanUseAI(HasRole):
    allowed_roles = ["owner", "admin", "member"]


class CanViewAI(HasRole):
    allowed_roles = ["owner", "admin", "member", "viewer"]
