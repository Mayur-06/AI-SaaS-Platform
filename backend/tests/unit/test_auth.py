import pytest
import hashlib
import secrets
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from accounts.models import Organization, Membership
from billing.models import APIKey
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from middleware.api_key_auth import APIKeyAuthentication, CookieJWTAuthentication, BearerJWTAuthentication
from common.core.permissions import IsAuthenticatedAndActive

User = get_user_model()


@pytest.mark.django_db
class TestAuthentication:
    def test_register_creates_user_and_org(self, api_client, free_plan):
        Plan = __import__("billing.models", fromlist=["Plan"]).Plan
        response = api_client.post("/api/auth/register/", {
            "email": "newuser@test.ai",
            "password": "securepass123",
            "organization_name": "Test Org",
        }, format="json")
        assert response.status_code == 201
        assert User.objects.filter(email="newuser@test.ai").exists()
        org = Organization.objects.get(name="Test Org")
        assert org.plan.name == "free"

    def test_login_returns_tokens(self, api_client, org_a, owner_a):
        response = api_client.post("/api/auth/login/", {
            "email": owner_a.email,
            "password": "pass123",
        }, format="json")
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_authenticated_access_returns_user(self, api_client, org_a, owner_a):
        api_client.force_authenticate(user=owner_a)
        response = api_client.get("/api/org/")
        assert response.status_code == 200
        assert response.data["name"] == "Org A"

    def test_unauthenticated_access_denied(self, api_client):
        response = api_client.get("/api/org/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestAPIKeyAuthentication:
    def test_api_key_auth_success(self, api_client, org_a, api_key_a):
        raw_key = api_key_a.key_prefix + "x" * 32
        api_key_a.key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        api_key_a.save()
        api_client.credentials(HTTP_AUTHORIZATION=f"ApiKey {raw_key}")
        response = api_client.get("/api/keys/")
        assert response.status_code == 200

    def test_api_key_inactive_denied(self, api_client, org_a, api_key_a):
        api_key_a.is_active = False
        api_key_a.save()
        raw_key = api_key_a.key_prefix + "x" * 32
        api_client.credentials(HTTP_AUTHORIZATION=f"ApiKey {raw_key}")
        response = api_client.get("/api/keys/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestPermissions:
    def test_owner_can_manage_members(self, api_client, org_a, owner_a):
        api_client.force_authenticate(user=owner_a)
        response = api_client.get("/api/org/members/")
        assert response.status_code == 200

    def test_viewer_cannot_use_ai(self, api_client, org_a):
        viewer = User.objects.create_user(email="viewer@test.ai", password="pass123")
        Membership.objects.create(user=viewer, organization=org_a, role="viewer")
        api_client.force_authenticate(user=viewer)
        response = api_client.post("/api/ai/query/", {"question": "test"}, format="json")
        assert response.status_code == 403
