import os
import sys
import django
import time
from unittest.mock import MagicMock, patch

# Configure Django settings
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import User, Organization
from billing.models import Plan, ModelConfig, RoutingRule
from ai_service.services.model_router import ModelRouter, CircuitBreaker, _shared_circuit_breaker
from common.core.views import AdminRoutingView

def log_test(name, success=True, detail=""):
    mark = "PASS" if success else "FAIL"
    print(f"[{mark}] {name} {detail}")


def run_tests():
    print("=" * 65)
    print("STARTING SUPERADMIN MODEL ROUTING & CASCADE TEST SUITE")
    print("=" * 65)

    # Setup database fixture
    admin_user, _ = User.objects.get_or_create(
        email="superadmin_test@test.com",
        defaults={"first_name": "Admin", "last_name": "User", "is_staff": True, "is_superuser": True}
    )
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()

    free_plan, _ = Plan.objects.get_or_create(name="free", defaults={"price_monthly": 0})
    pro_plan, _ = Plan.objects.get_or_create(name="pro", defaults={"price_monthly": 29})
    ent_plan, _ = Plan.objects.get_or_create(name="enterprise", defaults={"price_monthly": 99})

    gemini_model, _ = ModelConfig.objects.get_or_create(
        name="gemini-2.5-flash",
        defaults={"provider": "gemini", "input_cost_per_1k": "0.0001", "output_cost_per_1k": "0.0002", "is_active": True}
    )
    gemini_pro_model, _ = ModelConfig.objects.get_or_create(
        name="gemini-2.5-pro",
        defaults={"provider": "gemini", "input_cost_per_1k": "0.00025", "output_cost_per_1k": "0.001", "is_active": True}
    )

    factory = APIRequestFactory()
    view = AdminRoutingView.as_view()

    # -------------------------------------------------------------
    # TEST 1: GET /api/admin/routing/ returns rules, models, and circuit breaker status
    # -------------------------------------------------------------
    req = factory.get("/api/admin/routing/")
    force_authenticate(req, user=admin_user)
    resp = view(req)
    data = resp.content.decode("utf-8")
    import json
    parsed = json.loads(data)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert "plans" in parsed and "models" in parsed and "rules" in parsed, "Missing root keys"
    assert "circuit_breakers" in parsed, "Missing circuit_breakers status"
    assert "permitted_models" in parsed, "Missing permitted_models dictionary"
    log_test("AdminRoutingView GET: returns plans, models, rules, circuit breakers, permitted models")

    # -------------------------------------------------------------
    # TEST 2: POST /api/admin/routing/ - Save rule with primary, fallbacks, timeout
    # -------------------------------------------------------------
    save_payload = {
        "action": "save",
        "plan_name": "pro",
        "primary_model_id": str(gemini_model.id),
        "fallback_model_ids": [str(gemini_pro_model.id)],
        "timeout_seconds": 8,
    }
    req = factory.post("/api/admin/routing/", data=save_payload, format="json")
    force_authenticate(req, user=admin_user)
    resp = view(req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.content}"
    saved_data = json.loads(resp.content.decode("utf-8"))
    assert saved_data["rule"]["timeout_seconds"] == 8
    assert saved_data["rule"]["primary_model"]["name"] == "gemini-2.5-flash"
    assert len(saved_data["rule"]["fallback_models"]) == 1
    assert saved_data["rule"]["fallback_models"][0]["name"] == "gemini-2.5-pro"
    log_test("AdminRoutingView POST (save): correctly updates primary, fallbacks, and timeout (8s)")

    # -------------------------------------------------------------
    # TEST 3: Tier enforcement rejection (restricted model assignment)
    # -------------------------------------------------------------
    invalid_payload = {
        "action": "save",
        "plan_name": "free",
        "primary_model_id": str(gemini_pro_model.id), # gemini-2.5-pro is restricted on free tier
        "fallback_model_ids": [],
        "timeout_seconds": 10,
    }
    req = factory.post("/api/admin/routing/", data=invalid_payload, format="json")
    force_authenticate(req, user=admin_user)
    resp = view(req)
    assert resp.status_code == 400, f"Expected 400 Bad Request, got {resp.status_code}"
    err_body = json.loads(resp.content.decode("utf-8"))
    assert "not permitted" in err_body["error"]
    log_test("AdminRoutingView POST (tier restriction): blocks unauthorized high-tier models on free plan")

    # -------------------------------------------------------------
    # TEST 4: POST /api/admin/routing/ - Reset plan to platform defaults
    # -------------------------------------------------------------
    reset_payload = {"action": "reset", "plan_name": "enterprise"}
    req = factory.post("/api/admin/routing/", data=reset_payload, format="json")
    force_authenticate(req, user=admin_user)
    resp = view(req)
    assert resp.status_code == 200
    reset_data = json.loads(resp.content.decode("utf-8"))
    assert reset_data["rule"]["timeout_seconds"] == 90
    log_test("AdminRoutingView POST (reset): resets enterprise plan to recommended defaults (90s)")

    # -------------------------------------------------------------
    # TEST 5: ModelRouter - Normal execution on primary model
    # -------------------------------------------------------------
    test_breaker = CircuitBreaker()
    test_org, _ = Organization.objects.get_or_create(
        name="Router Test Org",
        defaults={"plan": pro_plan}
    )
    test_org.plan = pro_plan
    test_org.save()

    # Ensure rule for pro tier
    rule, _ = RoutingRule.objects.get_or_create(plan=pro_plan, defaults={"primary_model": gemini_model})
    rule.primary_model = gemini_model
    rule.timeout_seconds = 5
    rule.save()
    rule.fallback_models.set([gemini_pro_model])

    router = ModelRouter(organization=test_org, circuit_breaker=test_breaker)

    mock_gemini_provider = MagicMock()
    mock_gemini_provider.generate.return_value = "Hello from primary Gemini!"

    with patch.object(router, "_get_provider_instance", return_value=mock_gemini_provider):
        res = router.generate("System", "User prompt")
        assert res["answer"] == "Hello from primary Gemini!"
        assert res["model"] == "gemini-2.5-flash"
        assert res["attempts"] == 1
        assert len(res["errors"]) == 0
        assert res["cascade_log"][0]["status"] == "success"
    log_test("ModelRouter: Primary model resolves successfully on 1st attempt")

    # -------------------------------------------------------------
    # TEST 6: Fallback Cascade on Primary Provider Error (HTTP 500 / Exception)
    # -------------------------------------------------------------
    mock_failing_gemini = MagicMock()
    mock_failing_gemini.generate.side_effect = RuntimeError("503 Service Unavailable: High load")

    mock_success_gemini_pro = MagicMock()
    mock_success_gemini_pro.generate.return_value = "Hello from fallback Gemini Pro!"

    def mock_provider_selector(candidate):
        if candidate.name == "gemini-2.5-flash":
            return mock_failing_gemini
        return mock_success_gemini_pro

    with patch.object(router, "_get_provider_instance", side_effect=mock_provider_selector):
        res = router.generate("System", "User prompt")
        assert res["answer"] == "Hello from fallback Gemini Pro!"
        assert res["model"] == "gemini-2.5-pro"
        assert res["attempts"] == 2
        assert len(res["errors"]) == 1
        assert "503 Service Unavailable" in res["errors"][0]
        assert res["cascade_log"][0]["status"] == "failed"
        assert res["cascade_log"][1]["status"] == "success"
    log_test("ModelRouter: Automatically cascades to fallback candidate when primary throws error")

    # -------------------------------------------------------------
    # TEST 7: Fallback Cascade on Primary Timeout
    # -------------------------------------------------------------
    def slow_primary(*args, **kwargs):
        time.sleep(2.0)
        return "Too slow"

    mock_timeout_gemini = MagicMock()
    mock_timeout_gemini.generate.side_effect = slow_primary

    # Configure short 0.4s timeout rule
    rule.timeout_seconds = 1
    rule.save()

    def mock_provider_timeout_selector(candidate):
        if candidate.name == "gemini-2.5-flash":
            return mock_timeout_gemini
        return mock_success_gemini_pro

    router_timeout = ModelRouter(organization=test_org, circuit_breaker=test_breaker)
    # Patch get_route to have timeout = 0.5s for fast test
    orig_get_route = router_timeout.get_route
    def patched_route():
        r = orig_get_route()
        r["timeout"] = 0.4
        return r
    router_timeout.get_route = patched_route

    t0 = time.time()
    with patch.object(router_timeout, "_get_provider_instance", side_effect=mock_provider_timeout_selector):
        res = router_timeout.generate("System", "User prompt", simulate_timeout_models=["gemini-2.5-flash"])
        elapsed = time.time() - t0
        assert res["answer"] == "Hello from fallback Gemini Pro!"
        assert res["model"] == "gemini-2.5-pro"
        assert res["attempts"] == 2
        assert any("Timed out" in e for e in res["errors"])
        assert elapsed < 1.5, f"Execution took too long: {elapsed}s"
        assert res["cascade_log"][0]["status"] == "timeout"
        assert res["cascade_log"][1]["status"] == "success"
    log_test(f"ModelRouter: Strict timeout enforcement triggered fallback cascade (elapsed: {elapsed:.2f}s)")

    # -------------------------------------------------------------
    # TEST 8: Dynamic Circuit Breaker trips after 3 consecutive failures
    # -------------------------------------------------------------
    cb = CircuitBreaker(failure_threshold=3, window_seconds=60)
    cb_key = f"{gemini_model.provider}:{gemini_model.name}"
    assert not cb.is_open(cb_key)

    cb.record_failure(cb_key)
    cb.record_failure(cb_key)
    assert not cb.is_open(cb_key), "Should not trip after 2 failures"
    status_before = cb.get_status(cb_key)
    assert status_before["failure_count"] == 2
    assert not status_before["is_open"]

    cb.record_failure(cb_key)
    assert cb.is_open(cb_key), "Should trip after 3 failures"
    status_after = cb.get_status(cb_key)
    assert status_after["failure_count"] == 3
    assert status_after["is_open"]

    # When breaker is open, ModelRouter skips candidate immediately without invoking provider
    router_cb = ModelRouter(organization=test_org, circuit_breaker=cb)

    with patch.object(router_cb, "_get_provider_instance", return_value=mock_success_gemini_pro):
        res = router_cb.generate("System", "User prompt")
        assert res["model"] == "gemini-2.5-pro"
        assert any("Circuit breaker open" in e for e in res["errors"])
        assert res["cascade_log"][0]["status"] == "circuit_breaker_open"
        assert res["cascade_log"][1]["status"] == "success"
    log_test("ModelRouter: Circuit breaker trips after 3 failures and skips primary on 0ms check")

    # -------------------------------------------------------------
    # TEST 9: Circuit Breaker Reset Action
    # -------------------------------------------------------------
    cb.reset(cb_key)
    assert not cb.is_open(cb_key)
    assert cb.get_status(cb_key)["failure_count"] == 0
    log_test("CircuitBreaker: Reset clears failures and restores closed circuit state")

    # -------------------------------------------------------------
    # TEST 10: AdminRoutingView Simulation Action (POST action: 'test')
    # -------------------------------------------------------------
    test_sim_payload = {
        "action": "test",
        "plan_name": "pro",
        "simulate_failure": True, # Force primary failure to verify fallback simulation
    }
    req = factory.post("/api/admin/routing/", data=test_sim_payload, format="json")
    force_authenticate(req, user=admin_user)
    
    with patch("ai_service.services.model_router.ModelRouter._get_provider_instance", return_value=mock_success_gemini_pro):
        resp = view(req)
        assert resp.status_code == 200
        sim_data = json.loads(resp.content.decode("utf-8"))
        assert sim_data["status"] == "success"
        assert sim_data["attempts"] == 2
        assert sim_data["model_used"] == "gemini-2.5-pro"
        assert sim_data["cascade_log"][0]["status"] == "failed"
        assert sim_data["cascade_log"][1]["status"] == "success"
    log_test("AdminRoutingView POST (action: test): simulates fallback cascade and returns diagnostic trace")

    print("=" * 65)
    print("ALL 10 SUPERADMIN MODEL ROUTING & CASCADE TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()
