import pytest
from django.contrib.auth import get_user_model
from accounts.models import Organization, Membership, Invitation
from billing.models import Plan, APIKey, UsageLog, UsageAggregate, ModelConfig, RoutingRule
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry

User = get_user_model()


@pytest.fixture
def free_plan(db):
    return Plan.objects.create(
        name="free",
        monthly_request_limit=100,
        requests_per_minute=10,
        cache_ttl_seconds=3600,
        price=0,
    )


@pytest.fixture
def pro_plan(db):
    return Plan.objects.create(
        name="pro",
        monthly_request_limit=1000,
        requests_per_minute=60,
        cache_ttl_seconds=86400,
        price=29,
    )


@pytest.fixture
def enterprise_plan(db):
    return Plan.objects.create(
        name="enterprise",
        monthly_request_limit=999999,
        requests_per_minute=300,
        cache_ttl_seconds=604800,
        price=99,
    )


@pytest.fixture
def org_a(db, free_plan):
    org = Organization.objects.create(name="Org A", slug="org-a", plan=free_plan)
    user = User.objects.create_user(email="usera@test.ai", password="pass123", is_verified=True)
    Membership.objects.create(user=user, organization=org, role="owner")
    return org


@pytest.fixture
def org_b(db, free_plan):
    org = Organization.objects.create(name="Org B", slug="org-b", plan=free_plan)
    user = User.objects.create_user(email="userb@test.ai", password="pass123", is_verified=True)
    Membership.objects.create(user=user, organization=org, role="owner")
    return org


@pytest.fixture
def owner_a(org_a):
    return org_a.memberships.filter(role="owner").first().user


@pytest.fixture
def owner_b(org_b):
    return org_b.memberships.filter(role="owner").first().user


@pytest.fixture
def api_key_a(org_a):
    return APIKey.objects.create(organization=org_a, name="Key A", permissions="write")


@pytest.fixture
def api_key_b(org_b):
    return APIKey.objects.create(organization=org_b, name="Key B", permissions="write")


@pytest.fixture
def model_config_gemini(db):
    return ModelConfig.objects.create(
        name="gemini-2.0-flash",
        provider="gemini",
        input_cost_per_1k=0.0001,
        output_cost_per_1k=0.0004,
    )


@pytest.fixture
def model_config_gpt4o(db):
    return ModelConfig.objects.create(
        name="gpt-4o-mini",
        provider="openai",
        input_cost_per_1k=0.00015,
        output_cost_per_1k=0.0006,
    )


@pytest.fixture
def routing_rule_free(db, free_plan, model_config_gemini, model_config_gpt4o):
    rule = RoutingRule.objects.create(plan=free_plan, primary_model=model_config_gemini, timeout_seconds=10)
    rule.fallback_models.set([model_config_gpt4o])
    return rule


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()
