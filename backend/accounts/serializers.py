import hashlib
import secrets
from datetime import timedelta
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Organization, Membership, Invitation
from billing.models import Plan


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "is_verified", "is_staff", "created_at"]
        read_only_fields = ["id", "is_verified", "is_staff", "created_at"]


class OrganizationSerializer(serializers.ModelSerializer):
    plan = serializers.SlugRelatedField(
        slug_field="name",
        queryset=Plan.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "plan", "monthly_budget", "budget_alert_threshold", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user_id", "user_email", "role", "joined_at", "is_active"]
        read_only_fields = ["id", "user_id", "user_email", "joined_at", "is_active"]


class InvitationSerializer(serializers.ModelSerializer):
    raw_token = serializers.CharField(write_only=True, required=False)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "organization_name", "expires_at", "accepted_at", "raw_token"]
        read_only_fields = ["id", "expires_at", "accepted_at", "organization_name"]

    def create(self, validated_data):
        raw_token = validated_data.pop("raw_token", None) or secrets.token_urlsafe(32)
        validated_data["token_hash"] = hashlib.sha256(raw_token.encode()).hexdigest()
        invitation = super().create(validated_data)
        invitation.raw_token = raw_token
        return invitation


class OrganizationCreateSerializer(serializers.Serializer):
    organization_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)


class AuthRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    organization_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    invite_token = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        organization_name = validated_data.get("organization_name", "")
        invite_token = validated_data.get("invite_token", "")

        if invite_token:
            token_hash = hashlib.sha256(invite_token.encode()).hexdigest()
            invitation = Invitation.objects.select_for_update().get(
                token_hash=token_hash,
                accepted_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            if invitation.email != email:
                raise serializers.ValidationError("Email does not match the invitation.")
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["accepted_at"])
            org = invitation.organization
            role = invitation.role
        else:
            if not organization_name:
                raise serializers.ValidationError("organization_name is required when not using invite_token.")
            org, _ = Organization.objects.get_or_create(
                name=organization_name,
                defaults={"slug": organization_name.lower().replace(" ", "-")[:100]},
            )
            from billing.models import Plan
            free_plan, _ = Plan.objects.get_or_create(name=Plan.PLAN_FREE, defaults={
                "monthly_request_limit": 100,
                "requests_per_minute": 10,
                "price": 0,
            })
            org.plan = free_plan
            org.save()
            role = Membership.ROLE_OWNER

        user = User.objects.create_user(email=email, password=password, is_verified=True)
        Membership.objects.create(user=user, organization=org, role=role, invited_by=None)
        return user


class AuthLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(request=self.context.get("request"), email=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class AuthRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()
