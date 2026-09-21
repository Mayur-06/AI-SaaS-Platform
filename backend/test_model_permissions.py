import os
import django

os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
django.setup()

from decimal import Decimal
from unittest.mock import patch, MagicMock
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import Organization, User, Membership
from billing.models import Plan
from ai_service.views import AIQueryView
from ai_service.services.model_router import PLAN_PERMITTED_MODELS


def test_model_plan_permissions():
    print("=" * 80)
    print("TESTING MODEL SELECTION PERMISSIONS ACROSS PLANS")
    print("=" * 80)

    factory = APIRequestFactory()
    view = AIQueryView.as_view()

    # 1. Setup Plans
    free_plan, _ = Plan.objects.get_or_create(name="free", defaults={"monthly_request_limit": 100, "price": Decimal("0.00")})
    pro_plan, _ = Plan.objects.get_or_create(name="pro", defaults={"monthly_request_limit": 1000, "price": Decimal("49.00")})
    ent_plan, _ = Plan.objects.get_or_create(name="enterprise", defaults={"monthly_request_limit": 999999, "price": Decimal("199.00")})

    # Setup User & Org
    org, _ = Organization.objects.get_or_create(slug="test-model-org", defaults={"name": "Model Test Org", "plan": free_plan, "is_active": True})
    user, _ = User.objects.get_or_create(email="model-tester@test.com", defaults={"is_active": True, "is_verified": True})
    user.is_verified = True
    user.save()
    Membership.objects.get_or_create(organization=org, user=user, defaults={"role": "member", "is_active": True})

    # Mock RAGOrchestrator.query so we verify permission checks without external network calls
    mock_result = {
        "answer": "Operational response",
        "model": "gemini-2.5-flash",
        "provider": "gemini",
        "input_tokens": 10,
        "output_tokens": 20,
        "latency_ms": 100,
        "estimated_cost": 0.0001,
        "cache_hit": False,
        "request_id": "test-req-1",
        "chunks_retrieved": 0,
        "cited_chunks": [],
    }

    with patch("ai_service.views.RAGOrchestrator") as MockOrchestrator:
        instance = MockOrchestrator.return_value
        instance.query.return_value = mock_result

        # [TEST 1] Free tier requesting Enterprise model (gpt-4)
        print("\n[Case 1] Free tier requesting 'gpt-4' (Enterprise only):")
        org.plan = free_plan
        org.save()
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gpt-4"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        print(f"  • Error code: {resp.data.get('error', {}).get('code')}")
        print(f"  • Error message: {resp.data.get('error', {}).get('message')}")
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        assert resp.data["error"]["code"] == "MODEL_NOT_PERMITTED"

        # [TEST 2] Free tier requesting Pro model (gpt-4o-mini)
        print("\n[Case 2] Free tier requesting 'gpt-4o-mini' (Pro only):")
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gpt-4o-mini"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        assert resp.data["error"]["code"] == "MODEL_NOT_PERMITTED"

        # [TEST 3] Free tier requesting permitted model (gemini-2.5-flash)
        print("\n[Case 3] Free tier requesting 'gemini-2.5-flash' (Permitted):")
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gemini-2.5-flash"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        instance.query.assert_called_with("Hello", model="gemini-2.5-flash")

        # [TEST 4] Pro tier requesting Enterprise model (gpt-4)
        print("\n[Case 4] Pro tier requesting 'gpt-4' (Enterprise only):")
        org.plan = pro_plan
        org.save()
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gpt-4"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"

        # [TEST 5] Pro tier requesting Pro model (gpt-4o-mini)
        print("\n[Case 5] Pro tier requesting 'gpt-4o-mini' (Permitted):")
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gpt-4o-mini"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        instance.query.assert_called_with("Hello", model="gpt-4o-mini")

        # [TEST 6] Enterprise tier requesting Enterprise model (gpt-4)
        print("\n[Case 6] Enterprise tier requesting 'gpt-4' (Permitted):")
        org.plan = ent_plan
        org.save()
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "gpt-4"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        instance.query.assert_called_with("Hello", model="gpt-4")

        # [TEST 7] Auto-routing on any tier
        print("\n[Case 7] Requesting 'auto' model:")
        req = factory.post("/api/ai/query/", {"question": "Hello", "model": "auto"}, format="json")
        force_authenticate(req, user=user)
        resp = view(req)
        print(f"  • Status Code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        instance.query.assert_called_with("Hello", model="auto")

    print("\n" + "=" * 80)
    print(" ALL MODEL PERMISSION TESTS PASSED!")
    print("=" * 80)


if __name__ == "__main__":
    test_model_plan_permissions()
