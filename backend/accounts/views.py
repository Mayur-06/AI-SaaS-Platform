import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from accounts.models import User, Organization, Membership, Invitation
from accounts.serializers import (
    UserSerializer, OrganizationSerializer, MembershipSerializer, MembershipCreateSerializer,
    InvitationSerializer, InvitationCreateSerializer, AuthRegisterSerializer, AuthLoginSerializer, AuthRefreshSerializer,
    OrganizationCreateSerializer, TransferOwnershipSerializer,
)

from rest_framework.permissions import IsAuthenticated, AllowAny
from common.core.permissions import (
    IsAuthenticatedAndActive, IsOrgOwner, IsAdminOrOwner, CanManageMembers,
    IsOwner, CanUseAI, HasRole, IsOwnerOrReadOnly,
)
from common.core.exceptions import api_exception_handler
import secrets

logger = logging.getLogger(__name__)


class AuthRegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=AuthRegisterSerializer)
    def post(self, request):
        serializer = AuthRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        refresh["user_id"] = str(user.id)
        membership = user.memberships.filter(is_active=True).select_related("organization", "organization__plan").first()
        org_data = None
        if membership:
            refresh["org_id"] = str(membership.organization.id)
            refresh["role"] = membership.role
            org_data = OrganizationSerializer(membership.organization).data
            org_data["role"] = membership.role
        else:
            refresh["org_id"] = None
            refresh["role"] = None
        return Response({
            "user": UserSerializer(user).data,
            "organization": org_data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=AuthLoginSerializer)
    def post(self, request):
        serializer = AuthLoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        refresh["user_id"] = str(user.id)
        membership = user.memberships.filter(is_active=True).select_related("organization", "organization__plan").first()
        org_data = None
        if membership:
            refresh["org_id"] = str(membership.organization.id)
            refresh["role"] = membership.role
            org_data = OrganizationSerializer(membership.organization).data
            org_data["role"] = membership.role
        else:
            refresh["org_id"] = None
            refresh["role"] = None
        response = Response({
            "user": UserSerializer(user).data,
            "organization": org_data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_200_OK)
        response.set_cookie(
            "access_token", str(refresh.access_token),
            httponly=True, secure=not request.META.get("DEBUG", True),
            samesite="Lax",
        )
        return response


class AuthRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class AuthPasswordResetView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request={"type": "object", "properties": {"email": {"type": "string"}}, "required": ["email"]})
    def post(self, request):
        from django.core.signing import TimestampSigner
        email = request.data.get("email")
        reset_token = None
        if email:
            try:
                user = User.objects.get(email=email, is_active=True)
                signer = TimestampSigner()
                reset_token = signer.sign(str(user.id))
                logger.info("Password reset token generated for %s: %s", email, reset_token)
            except User.DoesNotExist:
                pass
        resp_data = {"detail": "If an account exists, a reset token has been sent."}
        if reset_token:
            resp_data["reset_token"] = reset_token
        return Response(resp_data, status=status.HTTP_200_OK)


class AuthPasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request={"type": "object", "properties": {"token": {"type": "string"}, "password": {"type": "string"}}, "required": ["token", "password"]})
    def post(self, request):
        from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
        token = request.data.get("token")
        password = request.data.get("password")
        if not token or not password:
            return Response({"detail": "Token and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        signer = TimestampSigner()
        try:
            user_id = signer.unsign(token, max_age=86400)
            user = User.objects.get(id=user_id, is_active=True)
            user.set_password(password)
            user.save()
            logger.info("Password reset confirmed for user %s", user.email)
            return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)
        except (BadSignature, SignatureExpired, User.DoesNotExist):
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)


class AuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
        signer = TimestampSigner()
        try:
            user_id = signer.unsign(token, max_age=86400 * 7)
            user = User.objects.get(id=user_id, is_active=True)
            user.is_verified = True
            user.save(update_fields=["is_verified"])
            logger.info("Email verified for user %s", user.email)
            return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)
        except (BadSignature, SignatureExpired, User.DoesNotExist):
            return Response({"detail": "Invalid or expired verification token."}, status=status.HTTP_400_BAD_REQUEST)


class OrganizationView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        membership = request.user.memberships.filter(is_active=True, organization__is_active=True).first()
        if not membership:
            return Response({"detail": "No active organization membership."}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(membership.organization)
        data = dict(serializer.data)
        data["role"] = membership.role
        return Response(data)

    @extend_schema(request=OrganizationSerializer, responses=OrganizationSerializer)
    def put(self, request):
        membership = request.user.memberships.filter(is_active=True, organization__is_active=True).first()
        if not membership:
            return Response({"detail": "No active organization membership."}, status=status.HTTP_404_NOT_FOUND)
        org = membership.organization
        if membership.role not in ["owner", "admin"]:
            return Response({"detail": "Insufficient permissions."}, status=status.HTTP_403_FORBIDDEN)
        serializer = OrganizationSerializer(org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @transaction.atomic
    def patch(self, request):
        return self.put(request)

    @transaction.atomic
    def delete(self, request):
        membership = request.user.memberships.filter(is_active=True, organization__is_active=True, role="owner").first()
        if not membership:
            return Response({"detail": "You are not the owner."}, status=status.HTTP_403_FORBIDDEN)
        perform_delete_organization(membership.organization)
        return Response(status=status.HTTP_204_NO_CONTENT)


def perform_delete_organization(org):
    from billing.models import APIKey, UsageLog, UsageAggregate, Invoice
    from ai_service.models import CacheEntry, Document, DocumentChunk, AIQuery
    from middleware.redis_utils import get_redis_client
    from django.core.files.storage import default_storage

    # 1. Clean up stored document files on disk/storage
    try:
        docs = list(Document.objects.filter(organization=org))
        for doc in docs:
            if doc.filename:
                try:
                    if default_storage.exists(doc.filename):
                        default_storage.delete(doc.filename)
                except Exception as file_err:
                    logger.warning("Failed to delete document file %s: %s", doc.filename, file_err)
    except Exception as exc:
        logger.warning("Error cleaning up document files for org %s: %s", org.id, exc)

    # 2. Ensure all DocumentChunk records are completely deleted for this organization
    DocumentChunk.objects.filter(organization=org).delete()

    # 3. Ensure all Document records are completely deleted
    Document.objects.filter(organization=org).delete()

    # 4. Remove all AIQuery records
    AIQuery.objects.filter(organization=org).delete()

    # 5. Remove all semantic cache entries
    CacheEntry.objects.filter(organization=org).delete()

    # 6. Flush Redis cache keys for this tenant if available
    try:
        r = get_redis_client()
        if r:
            keys = r.keys(f"semcache:{org.id}:*")
            if keys:
                r.delete(*keys)
            keys_all = r.keys(f"*{org.id}*")
            if keys_all:
                r.delete(*keys_all)
    except Exception as exc:
        logger.debug("Failed to flush redis cache on org delete: %s", exc)

    # 7. Delete all API keys
    APIKey.objects.filter(organization=org).delete()

    # 8. Delete usage logs, usage aggregates, and invoices
    UsageLog.objects.filter(organization=org).delete()
    UsageAggregate.objects.filter(organization=org).delete()
    Invoice.objects.filter(organization=org).delete()

    # 9. Delete pending invitations
    org.invitations.all().delete()

    # 10. Delete memberships
    org.memberships.all().delete()

    # 11. Full record delete of the organization itself
    org.delete()


def perform_transfer_ownership(current_user, target_id, organization=None):
    if organization:
        membership = current_user.memberships.filter(organization=organization, is_active=True, organization__is_active=True, role="owner").first()
    else:
        membership = current_user.memberships.filter(is_active=True, organization__is_active=True, role="owner").first()

    if not membership:
        return Response({"detail": "You are not the owner."}, status=status.HTTP_403_FORBIDDEN)

    new_membership = Membership.objects.select_for_update().filter(
        Q(id=target_id) | Q(user_id=target_id),
        organization=membership.organization,
        is_active=True,
    ).select_related("user").first()

    if not new_membership:
        return Response({"detail": "Target membership not found."}, status=status.HTTP_404_NOT_FOUND)

    if new_membership.user_id == current_user.id:
        return Response({"detail": "You are already the owner of this organization."}, status=status.HTTP_400_BAD_REQUEST)

    if not new_membership.user.is_active or not getattr(new_membership.user, "is_verified", False):
        return Response({"detail": "Target user account is inactive or not verified."}, status=status.HTTP_400_BAD_REQUEST)

    membership.role = Membership.ROLE_VIEWER
    membership.save(update_fields=["role"])
    new_membership.role = Membership.ROLE_OWNER
    new_membership.save(update_fields=["role"])

    refresh = RefreshToken.for_user(current_user)
    refresh["user_id"] = str(current_user.id)
    refresh["org_id"] = str(membership.organization_id)
    refresh["role"] = Membership.ROLE_VIEWER

    return Response({
        "detail": "Ownership transferred successfully.",
        "previous_owner_id": str(current_user.id),
        "new_owner_id": str(new_membership.user_id),
        "organization_id": str(membership.organization_id),
        "role": Membership.ROLE_VIEWER,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }, status=status.HTTP_200_OK)


class TransferOwnershipView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsOrgOwner]

    @transaction.atomic
    @extend_schema(request=TransferOwnershipSerializer)
    def post(self, request):
        serializer = TransferOwnershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return perform_transfer_ownership(request.user, serializer.validated_data["new_owner_id"], getattr(request, "organization", None))


class OrganizationDeleteView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsOrgOwner]

    @transaction.atomic
    def delete(self, request):
        membership = request.user.memberships.filter(is_active=True, organization__is_active=True, role="owner").first()
        if not membership:
            return Response({"detail": "You are not the owner."}, status=status.HTTP_403_FORBIDDEN)
        perform_delete_organization(membership.organization)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def _get_org(self):
        org = getattr(self.request, "organization", None)
        if not org and hasattr(self.request, "user") and self.request.user.is_authenticated:
            membership = self.request.user.memberships.filter(is_active=True, organization__is_active=True).select_related("organization").first()
            if membership:
                org = membership.organization
                self.request.organization = org
        return org

    def get_queryset(self):
        org = self._get_org()
        return Membership.objects.filter(organization=org, is_active=True) if org else Membership.objects.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndActive()]
        if self.action in ["update", "partial_update", "create"]:
            return [IsAuthenticatedAndActive(), CanManageMembers()]
        return [IsAuthenticatedAndActive(), CanManageMembers()]

    def get_serializer_class(self):
        if self.action == "create":
            return MembershipCreateSerializer
        return MembershipSerializer

    def perform_create(self, serializer):
        from rest_framework import exceptions
        org = self._get_org()
        if not org:
            raise exceptions.NotFound("No active organization membership.")
        user_id = serializer.validated_data.get("user_id")
        email = serializer.validated_data.get("email")
        if user_id:
            user = User.objects.filter(id=user_id, is_active=True).first()
        else:
            user = User.objects.filter(email=email, is_active=True).first()

        if not user:
            raise exceptions.ValidationError("User not found or inactive.")

        if Membership.objects.filter(user=user, organization=org, is_active=True).exists():
            raise exceptions.ValidationError("User is already an active member of this organization.")

        serializer.save(user=user, organization=org)

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]
        obj = queryset.filter(Q(id=lookup_value) | Q(user__id=lookup_value)).first()
        if not obj:
            from rest_framework.exceptions import NotFound
            raise NotFound("Member not found.")
        self.check_object_permissions(self.request, obj)
        return obj

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        membership = self.get_object()
        new_role = request.data.get("role")
        if new_role == Membership.ROLE_ADMIN:
            return Response({"detail": "Admin role choice is not available. Only Member or Viewer may be assigned."}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == Membership.ROLE_OWNER:
            return Response({"detail": "Cannot modify owner role. Use transfer ownership."}, status=status.HTTP_400_BAD_REQUEST)
        if new_role == Membership.ROLE_OWNER:
            return Response({"detail": "Cannot promote to owner directly. Use transfer ownership."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        membership = self.get_object()
        new_role = request.data.get("role")
        if new_role == Membership.ROLE_ADMIN:
            return Response({"detail": "Admin role choice is not available. Only Member or Viewer may be assigned."}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == Membership.ROLE_OWNER:
            return Response({"detail": "Cannot modify owner role. Use transfer ownership."}, status=status.HTTP_400_BAD_REQUEST)
        if new_role == Membership.ROLE_OWNER:
            return Response({"detail": "Cannot promote to owner directly. Use transfer ownership."}, status=status.HTTP_400_BAD_REQUEST)
        return super().partial_update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()

        caller_membership = request.user.memberships.filter(
            organization=membership.organization,
            is_active=True,
        ).first()
        if not caller_membership:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        # Cannot remove the owner
        if membership.role == Membership.ROLE_OWNER:
            return Response({"detail": "Cannot remove the owner."}, status=status.HTTP_403_FORBIDDEN)

        # Only the owner can remove an admin
        if membership.role == Membership.ROLE_ADMIN and caller_membership.role != Membership.ROLE_OWNER:
            return Response({"detail": "Only the owner can remove an admin."}, status=status.HTTP_403_FORBIDDEN)

        target_user = membership.user
        membership.delete()
        if target_user:
            target_user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def transfer_ownership(self, request, pk=None):
        membership = self.get_object()
        user_membership = request.user.memberships.filter(is_active=True, role="owner").first()
        if not user_membership or user_membership.organization != membership.organization:
            return Response({"detail": "Only owner can transfer ownership."}, status=status.HTTP_403_FORBIDDEN)
        return perform_transfer_ownership(request.user, membership.id, membership.organization)


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticatedAndActive, CanManageMembers]

    def _get_org(self):
        org = getattr(self.request, "organization", None)
        if not org and hasattr(self.request, "user") and self.request.user.is_authenticated:
            membership = self.request.user.memberships.filter(is_active=True, organization__is_active=True).select_related("organization").first()
            if membership:
                org = membership.organization
                self.request.organization = org
        return org

    def get_queryset(self):
        org = self._get_org()
        return Invitation.objects.filter(organization=org) if org else Invitation.objects.none()

    def get_serializer_class(self):
        if self.action == "create":
            return InvitationCreateSerializer
        return InvitationSerializer

    def perform_create(self, serializer):
        from rest_framework import exceptions
        org = self._get_org()
        if not org:
            raise exceptions.NotFound("No active organization membership.")
        serializer.save(organization=org)

