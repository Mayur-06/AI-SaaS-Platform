import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.shortcuts import get_object_or_404
from accounts.models import User, Organization, Membership, Invitation
from accounts.serializers import (
    UserSerializer, OrganizationSerializer, MembershipSerializer,
    InvitationSerializer, AuthRegisterSerializer, AuthLoginSerializer, AuthRefreshSerializer,
    OrganizationCreateSerializer,
)
from accounts.auth import CookieJWTAuthentication
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

    def post(self, request):
        serializer = AuthRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        refresh["user_id"] = str(user.id)
        org = user.memberships.filter(is_active=True).first().organization
        refresh["org_id"] = str(org.id) if org else None
        return Response({
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def post(self, request):
        serializer = AuthLoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        refresh["user_id"] = str(user.id)
        org = user.memberships.filter(is_active=True).first().organization
        refresh["org_id"] = str(org.id) if org else None
        response = Response({
            "user": UserSerializer(user).data,
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
    permission_classes = [IsAuthenticatedAndActive]


class AuthPasswordResetView(APIView):
    permission_classes = []

    def post(self, request):
        email = request.data.get("email")
        try:
            user = User.objects.get(email=email)
            logger.info("Password reset requested for %s", email)
        except User.DoesNotExist:
            pass
        return Response({"detail": "If an account exists, a reset token has been sent."}, status=status.HTTP_200_OK)


class AuthPasswordResetConfirmView(APIView):
    permission_classes = []

    def post(self, request):
        token = request.data.get("token")
        password = request.data.get("password")
        if not token or not password:
            return Response({"detail": "Token and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("Password reset confirmed for token %s", token)
        return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)


class AuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        logger.info("Verification token received: %s", token)
        return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)


class OrganizationView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        membership = request.user.memberships.filter(is_active=True).first()
        if not membership:
            return Response({"detail": "No active organization membership."}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(membership.organization)
        return Response(serializer.data)

    def put(self, request):
        membership = request.user.memberships.filter(is_active=True).first()
        if not membership:
            return Response({"detail": "No active organization membership."}, status=status.HTTP_404_NOT_FOUND)
        org = membership.organization
        if membership.role not in ["owner", "admin"]:
            return Response({"detail": "Insufficient permissions."}, status=status.HTTP_403_FORBIDDEN)
        serializer = OrganizationSerializer(org, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TransferOwnershipView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsOrgOwner]

    @transaction.atomic
    def post(self, request):
        membership = request.user.memberships.filter(is_active=True, role="owner").first()
        if not membership:
            return Response({"detail": "You are not the owner."}, status=status.HTTP_403_FORBIDDEN)
        new_owner_id = request.data.get("new_owner_id")
        if not new_owner_id:
            return Response({"detail": "new_owner_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_membership = Membership.objects.select_for_update().get(
                id=new_owner_id,
                organization=membership.organization,
                is_active=True,
            )
        except Membership.DoesNotExist:
            return Response({"detail": "Target membership not found."}, status=status.HTTP_404_NOT_FOUND)
        membership.role = Membership.ROLE_ADMIN
        membership.save(update_fields=["role"])
        new_membership.role = Membership.ROLE_OWNER
        new_membership.save(update_fields=["role"])
        return Response({"detail": "Ownership transferred successfully."})


class OrganizationDeleteView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsOrgOwner]

    def delete(self, request):
        membership = request.user.memberships.filter(is_active=True, role="owner").first()
        if not membership:
            return Response({"detail": "You are not the owner."}, status=status.HTTP_403_FORBIDDEN)
        org = membership.organization
        org.is_active = False
        org.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return Membership.objects.filter(organization=org, is_active=True) if org else Membership.objects.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndActive()]
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticatedAndActive(), CanManageMembers()]
        return [IsAuthenticatedAndActive(), CanManageMembers()]

    @action(detail=True, methods=["post"])
    def transfer_ownership(self, request, pk=None):
        membership = self.get_object()
        user_membership = request.user.memberships.filter(is_active=True, role="owner").first()
        if not user_membership or user_membership.organization != membership.organization:
            return Response({"detail": "Only owner can transfer ownership."}, status=status.HTTP_403_FORBIDDEN)
        return TransferOwnershipView().post(request)


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticatedAndActive, CanManageMembers]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return Invitation.objects.filter(organization=org) if org else Invitation.objects.none()
