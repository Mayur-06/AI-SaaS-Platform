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
            if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
                return user.is_active
            return user.is_active and getattr(user, "is_verified", False)
        return True


ADMIN_API_PERMISSIONS = {"admin", "admin:*", "org:admin"}


class HasRole(permissions.BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            if key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin")):
                return True
            return False

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
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            return key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin"))
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
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            return key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin"))
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

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            if hasattr(key, "has_scope"):
                return key.has_scope("rag:query") or key.has_scope("documents:write")
            return getattr(key, "permissions", "") in ["write", "admin", "admin:*", "org:admin", "rag:query"]
        return super().has_permission(request, view)


class CanViewAI(HasRole):
    allowed_roles = ["owner", "admin", "member", "viewer"]

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            if hasattr(key, "has_scope"):
                return key.has_scope("documents:read") or key.has_scope("rag:query")
            return getattr(key, "permissions", "") in ["read", "write", "admin", "admin:*", "org:admin", "rag:query", "documents:read"]
        return super().has_permission(request, view)


class CanAccessOrg(permissions.BasePermission):
    """
    Permits viewing and updating organization details.
    - User sessions: active organization members.
    - API keys: requires organization admin scope ('admin', 'admin:*', 'org:admin').
    """
    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            return key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin"))
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        return user.memberships.filter(is_active=True, organization__is_active=True).exists()


class CanAccessMembers(permissions.BasePermission):
    """
    Permits viewing organization member lists.
    - User sessions: active organization members.
    - API keys: requires organization admin scope ('admin', 'admin:*', 'org:admin').
    """
    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            return key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin"))
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        return user.memberships.filter(is_active=True, organization__is_active=True).exists()


class CanAccessBilling(permissions.BasePermission):
    """
    Permits viewing billing information, plan tiers, and usage logs.
    - User sessions: active organization members.
    - API keys: requires organization admin scope ('admin', 'admin:*', 'org:admin').
    """
    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            key_perm = getattr(key, "permissions", "")
            return key_perm in ADMIN_API_PERMISSIONS or (hasattr(key, "has_scope") and key.has_scope("admin")) or key_perm in ["write", "admin"]
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        return user.memberships.filter(is_active=True, organization__is_active=True).exists()


class HasScope(permissions.BasePermission):
    """
    Checks that an APIKey request has the required granular scope,
    or that an authenticated user has an allowed membership role.
    """
    required_scope = None
    allowed_roles = ["owner", "admin", "member"]

    def has_permission(self, request, view):
        if getattr(request, "api_key", None):
            key = request.api_key
            if hasattr(key, "has_scope") and self.required_scope:
                return key.has_scope(self.required_scope)
            if self.required_scope:
                return getattr(key, "permissions", "") in [self.required_scope, *ADMIN_API_PERMISSIONS]
            return getattr(key, "permissions", "") in ADMIN_API_PERMISSIONS

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


class CanQueryRAG(HasScope):
    required_scope = "rag:query"
    allowed_roles = ["owner", "admin", "member"]


class CanReadDocuments(HasScope):
    required_scope = "documents:read"
    allowed_roles = ["owner", "admin", "member", "viewer"]


class CanWriteDocuments(HasScope):
    required_scope = "documents:write"
    allowed_roles = ["owner", "admin", "member"]

