import os, sys
from pathlib import Path
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
import os
import django

os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
django.setup()

from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import Organization, User, Membership
from billing.models import Plan, UsageLog, UsageAggregate, ModelConfig
from billing.views import BillingUsageView
from common.core.views import AdminUsageView, AdminTenantsView
from ai_service.services.usage_tracker import log_usage


def test_usage_and_cost_tracking():
    print("=" * 80)
    print("TESTING USAGE & COST CALCULATIONS AND REAL-TIME TRACKING")
    print("=" * 80)

    factory = APIRequestFactory()

    # 1. Setup Plans
    free_plan, _ = Plan.objects.get_or_create(
        name="free",
        defaults={"monthly_request_limit": 100, "requests_per_minute": 10, "price": Decimal("0.00")}
    )
    free_plan.monthly_request_limit = 100
    free_plan.price = Decimal("0.00")
    free_plan.save()

    pro_plan, _ = Plan.objects.get_or_create(
        name="pro",
        defaults={"monthly_request_limit": 1000, "requests_per_minute": 60, "price": Decimal("49.00")}
    )
    pro_plan.monthly_request_limit = 1000
    pro_plan.price = Decimal("49.00")
    pro_plan.save()

    # 2. Setup Organization on Free Plan
    org, _ = Organization.objects.get_or_create(
        slug="test-cost-org",
        defaults={"name": "Cost Test Org", "plan": free_plan, "monthly_budget": Decimal("100.00"), "is_active": True}
    )
    org.plan = free_plan
    org.monthly_budget = Decimal("100.00")
    org.is_active = True
    org.save()

    user, _ = User.objects.get_or_create(
        email="owner-cost@test.com",
        defaults={"is_active": True, "is_verified": True}
    )
    user.is_active = True
    user.is_verified = True
    user.save()

    membership, _ = Membership.objects.get_or_create(
        organization=org,
        user=user,
        defaults={"role": "owner", "is_active": True}
    )
    membership.is_active = True
    membership.role = "owner"
    membership.save()

    # Clean existing logs for clean assertions
    UsageLog.objects.filter(organization=org).delete()
    UsageAggregate.objects.filter(organization=org).delete()

    billing_view = BillingUsageView.as_view()

    # [Step 1] Baseline
    print("\n[Step 1] Baseline Free Plan Usage Metrics:")
    req = factory.get("/api/billing/usage/")
    force_authenticate(req, user=user)
    resp = billing_view(req)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.data
    print(f"  • Plan: {data['plan']['name']}")
    print(f"  • Monthly Limit: {data['monthly_limit']} (from Free Plan)")
    print(f"  • Requests Used: {data['requests_used']}")
    print(f"  • Total Cost: ${data['total_cost']}")
    print(f"  • Budget Remaining: ${data['budget_remaining']}")
    print(f"  • Projected Spend: ${data['projected_monthly_spend']}")
    print(f"  • Cache Savings: ${data['cache_savings']}")

    assert data["monthly_limit"] == 100, "Free plan limit should be 100"
    assert data["requests_used"] == 0
    assert data["total_cost"] == 0

    # [Step 2] Live LLM Requests
    print("\n[Step 2] Simulating 5 Live LLM Queries with Token Costs:")
    for i in range(5):
        log_usage(
            organization=org,
            endpoint="/api/ai/query/",
            model_used="gemini-2.5-flash",
            input_tokens=150,
            output_tokens=300,
            latency_ms=450,
            estimated_cost=0.000350,
            cache_hit=False,
            user=user,
        )

    req2 = factory.get("/api/billing/usage/")
    force_authenticate(req2, user=user)
    resp2 = billing_view(req2)
    data2 = resp2.data
    print(f"  • Requests Used: {data2['requests_used']} / {data2['monthly_limit']} ({data2['usage_percent']}%)")
    print(f"  • Total Tokens: {data2['input_tokens']} input, {data2['output_tokens']} output")
    print(f"  • Total Cost: ${data2['total_cost']}")
    print(f"  • Budget Remaining: ${data2['budget_remaining']} (Ceiling: $100)")
    print(f"  • Projected Spend: ${data2['projected_monthly_spend']}")

    assert data2["requests_used"] == 5, f"Expected 5 requests used, got {data2['requests_used']}"
    assert data2["usage_percent"] == 5.0, f"Expected 5% usage, got {data2['usage_percent']}"
    assert float(data2["total_cost"]) == float(round(Decimal("5") * Decimal("0.000350"), 4))
    assert data2["budget_remaining"] == round(100.0 - float(data2["total_cost"]), 2)

    # [Step 3] Cache Hits
    print("\n[Step 3] Simulating 5 Cached Queries (Cache Hits):")
    for i in range(5):
        log_usage(
            organization=org,
            endpoint="/api/ai/query/",
            model_used="cached",
            input_tokens=0,
            output_tokens=300,
            latency_ms=12,
            estimated_cost=0.0,
            cache_hit=True,
            user=user,
        )

    req3 = factory.get("/api/billing/usage/")
    force_authenticate(req3, user=user)
    resp3 = billing_view(req3)
    data3 = resp3.data
    print(f"  • Total Requests Used: {data3['requests_used']}")
    print(f"  • Cache Hits: {data3['cache_hits']}")
    print(f"  • Cache Hit Rate: {data3['cache_hit_rate']}%")
    print(f"  • Cache Savings reported: ${data3['cache_savings']}")
    print(f"  • Total Cost after cache hits: ${data3['total_cost']} (Unchanged from live LLM costs)")

    assert data3["requests_used"] == 10
    assert data3["cache_hits"] == 5
    assert data3["cache_hit_rate"] == 50.0
    assert float(data3["cache_savings"]) > 0, f"Expected cache savings > 0, got {data3['cache_savings']}"

    # [Step 4] Upgrade to Pro
    print("\n[Step 4] Upgrading Organization Plan to Pro ($49/mo, 1000 limit):")
    org.plan = pro_plan
    org.save(update_fields=["plan"])

    req4 = factory.get("/api/billing/usage/")
    force_authenticate(req4, user=user)
    resp4 = billing_view(req4)
    data4 = resp4.data
    print(f"  • New Plan Name: {data4['plan']['name']}")
    print(f"  • New Monthly Limit: {data4['monthly_limit']} (Updated from 100 to 1000 in real time)")
    print(f"  • New Usage Percent: {data4['usage_percent']}% (Recalculated: 10/1000 = 1%)")
    assert data4["monthly_limit"] == 1000, f"Expected 1000, got {data4['monthly_limit']}"
    assert data4["usage_percent"] == 1.0, f"Expected 1.0%, got {data4['usage_percent']}"

    # [Step 5] Superadmin Metrics
    print("\n[Step 5] Testing Superadmin Telemetry & Revenue Calculations:")
    admin_user, _ = User.objects.get_or_create(
        email="superadmin@test.com",
        defaults={"is_staff": True, "is_superuser": True, "is_active": True, "is_verified": True}
    )
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.is_verified = True
    admin_user.save()

    admin_usage_view = AdminUsageView.as_view()
    admin_req = factory.get("/api/admin/usage/")
    force_authenticate(admin_req, user=admin_user)
    admin_resp = admin_usage_view(admin_req)
    assert admin_resp.status_code == 200, f"Expected 200, got {admin_resp.status_code}"
    import json
    admin_data = json.loads(admin_resp.content.decode())
    print(f"  • Total Tenants: {admin_data['total_organizations']}")
    print(f"  • Monthly Revenue Estimate: ${admin_data['revenue_estimate']} (Sum of tenant plan prices)")
    print(f"  • Platform Cost: ${admin_data['platform_cost']}")
    print(f"  • Monthly Cost Estimate: ${admin_data['monthly_cost_estimate']} (Duplicate of platform_cost)")
    print(f"  • Requests This Month: {admin_data['requests_this_month']}")
    print(f"  • Requests Month: {admin_data['requests_month']} (Duplicate of requests_this_month)")
    print(f"  • Fleet Cache Hit Rate: {admin_data['cache_hit_rate_percent']}%")

    # Step 6: Tenant Table
    print("\n[Step 6] Testing Superadmin Tenant Breakdown:")
    tenant_view = AdminTenantsView.as_view()
    tenant_req = factory.get("/api/admin/tenants/")
    force_authenticate(tenant_req, user=admin_user)
    tenant_resp = tenant_view(tenant_req)
    assert tenant_resp.status_code == 200
    tenant_data = json.loads(tenant_resp.content.decode())
    matching_tenant = next((t for t in tenant_data["tenants"] if t["slug"] == "test-cost-org"), None)
    assert matching_tenant is not None
    print(f"  • Tenant Slug: {matching_tenant['slug']}")
    print(f"  • Plan: {matching_tenant['plan']['name']}")
    print(f"  • Monthly Requests: {matching_tenant['monthly_requests']}")
    print(f"  • Monthly Cost: ${matching_tenant['monthly_cost']}")
    assert matching_tenant["monthly_requests"] == 10
    assert float(matching_tenant["monthly_cost"]) == float(round(Decimal("5") * Decimal("0.000350"), 4))

    print("\n" + "=" * 80)
    print(" ALL USAGE & COST TRACKING TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    test_usage_and_cost_tracking()
