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
        fields = ["id", "name", "slug", "plan", "monthly_budget", "budget_alert_threshold", "cache_threshold", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_budget_alert_threshold(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError("Budget alert threshold must be between 1 and 100 percent.")
        return value

    def validate_monthly_budget(self, value):
        if value < 0:
            raise serializers.ValidationError("Monthly budget cannot be negative.")
        return value



class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user_id", "user_email", "role", "joined_at", "is_active"]
        read_only_fields = ["id", "user_id", "user_email", "joined_at", "is_active"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["user"] = {
            "id": str(instance.user.id),
            "email": instance.user.email,
        }
        return data


class MembershipCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(required=False)
    email = serializers.EmailField(required=False)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.ChoiceField(choices=Membership.ROLE_CHOICES, default=Membership.ROLE_MEMBER)

    class Meta:
        model = Membership
        fields = ["id", "user_id", "email", "user_email", "role", "joined_at", "is_active"]
        read_only_fields = ["id", "user_email", "joined_at", "is_active"]

    def validate(self, attrs):
        user_id = attrs.get("user_id")
        email = attrs.get("email")
        if not user_id and not email:
            raise serializers.ValidationError("Either user_id or email is required to add a member.")
        if attrs.get("role") == Membership.ROLE_OWNER:
            raise serializers.ValidationError("Cannot create owner member directly. Use transfer ownership.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("email", None)
        validated_data.pop("user_id", None)
        return super().create(validated_data)


class InvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "organization_name", "expires_at", "accepted_at"]
        read_only_fields = ["id", "expires_at", "accepted_at", "organization_name"]


class InvitationCreateSerializer(serializers.ModelSerializer):
    raw_token = serializers.CharField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "organization_name", "expires_at", "accepted_at", "raw_token"]
        read_only_fields = ["id", "expires_at", "accepted_at", "organization_name"]

    def create(self, validated_data):
        raw_token = secrets.token_urlsafe(32)
        validated_data["token_hash"] = hashlib.sha256(raw_token.encode()).hexdigest()
        invitation = super().create(validated_data)
        invitation.raw_token = raw_token
        return invitation


class TransferOwnershipSerializer(serializers.Serializer):
    new_owner_id = serializers.UUIDField(required=True)


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
            try:
                invitation = Invitation.objects.select_for_update().get(
                    token_hash=token_hash,
                    accepted_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
            except Invitation.DoesNotExist:
                raise serializers.ValidationError({"invite_token": "Invalid or expired invitation token."})

            if invitation.email.strip().lower() != email.strip().lower():
                raise serializers.ValidationError({"email": "Email does not match the invitation."})
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
