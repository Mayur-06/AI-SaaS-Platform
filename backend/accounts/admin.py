from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from accounts.models import User, Organization, Membership, Invitation


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["id", "email", "is_verified", "is_staff", "is_active", "created_at"]
    search_fields = ["email"]
    ordering = ["-created_at"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Permissions", {"fields": ["is_active", "is_verified", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Important dates", {"fields": ["last_login", "date_joined", "created_at"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "password1", "password2"]}),
    ]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "slug", "plan", "is_active", "created_at"]
    search_fields = ["name", "slug"]
    list_filter = ["plan", "is_active"]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "organization", "role", "is_active", "joined_at"]
    search_fields = ["user__email", "organization__name"]
    list_filter = ["role", "is_active"]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["id", "email", "organization", "role", "expires_at", "accepted_at"]
    search_fields = ["email", "organization__name"]
    list_filter = ["role"]
