import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from django.utils import timezone
from accounts.models import Organization, User, Membership
from billing.models import Plan, APIKey, UsageLog
from common.core.permissions import CanQueryRAG, CanReadDocuments, CanWriteDocuments
from middleware.redis_utils import check_token_rate_limit, record_token_usage


@pytest.mark.django_db
class TestAPIKeyScopes:
    def test_scope_backward_compatibility(self, db):
        plan = Plan.objects.create(name="Pro", monthly_request_limit=1000, price=29)
        org = Organization.objects.create(name="ScopeOrg", plan=plan)

        # 1. Standard write key
        write_key = APIKey.objects.create(organization=org, name="WriteKey", permissions="write")
        assert write_key.has_scope("rag:query") is True
        assert write_key.has_scope("documents:read") is True
        assert write_key.has_scope("documents:write") is True

        # 2. Legacy read key
        read_key = APIKey.objects.create(organization=org, name="ReadKey", permissions="read")
        assert read_key.has_scope("rag:query") is True
        assert read_key.has_scope("documents:read") is True
        assert read_key.has_scope("documents:write") is False

        # 3. Granular rag:query key
        query_key = APIKey.objects.create(organization=org, name="QueryKey", permissions="rag:query")
        assert query_key.has_scope("rag:query") is True
        assert query_key.has_scope("documents:read") is True
        assert query_key.has_scope("documents:write") is False

        # 4. Granular documents:write key
        doc_write_key = APIKey.objects.create(organization=org, name="DocWriteKey", permissions="documents:write")
        assert doc_write_key.has_scope("documents:write") is True
        assert doc_write_key.has_scope("documents:read") is True
        assert doc_write_key.has_scope("rag:query") is False

        # 5. Granular documents:read key
        doc_read_key = APIKey.objects.create(organization=org, name="DocReadKey", permissions="documents:read")
        assert doc_read_key.has_scope("documents:read") is True
        assert doc_read_key.has_scope("documents:write") is False
        assert doc_read_key.has_scope("rag:query") is False

        # 6. Admin key
        admin_key = APIKey.objects.create(organization=org, name="AdminKey", permissions="admin")
        assert admin_key.has_scope("rag:query") is True
        assert admin_key.has_scope("documents:write") is True
        assert admin_key.has_scope("documents:read") is True
        assert admin_key.has_scope("any_arbitrary_scope") is True

        # 7. Inactive key
        write_key.is_active = False
        write_key.save()
        assert write_key.has_scope("rag:query") is False


@pytest.mark.django_db
class TestScopePermissions:
    def test_permission_classes_with_api_keys(self, db):
        plan = Plan.objects.create(name="Pro", monthly_request_limit=1000, price=29)
        org = Organization.objects.create(name="PermOrg", plan=plan)

        query_key = APIKey.objects.create(organization=org, name="QueryKey", permissions="rag:query")
        doc_key = APIKey.objects.create(organization=org, name="DocKey", permissions="documents:write")

        req_query = MagicMock()
        req_query.api_key = query_key
        req_query.organization = org

        req_doc = MagicMock()
        req_doc.api_key = doc_key
        req_doc.organization = org

        # CanQueryRAG
        can_query = CanQueryRAG()
        assert can_query.has_permission(req_query, None) is True
        assert can_query.has_permission(req_doc, None) is False

        # CanWriteDocuments
        can_write_doc = CanWriteDocuments()
        assert can_write_doc.has_permission(req_doc, None) is True
        assert can_write_doc.has_permission(req_query, None) is False

        # CanReadDocuments
        can_read_doc = CanReadDocuments()
        assert can_read_doc.has_permission(req_query, None) is True
        assert can_read_doc.has_permission(req_doc, None) is True

    def test_org_and_billing_gating_for_api_keys(self, db):
        from common.core.permissions import CanAccessOrg, CanAccessMembers, CanAccessBilling, IsAdminOrOwner

        plan = Plan.objects.create(name="Pro", monthly_request_limit=1000, price=29)
        org = Organization.objects.create(name="GateOrg", plan=plan)

        query_key = APIKey.objects.create(organization=org, name="QueryKey", permissions="rag:query")
        doc_write_key = APIKey.objects.create(organization=org, name="DocKey", permissions="documents:write")
        doc_read_key = APIKey.objects.create(organization=org, name="DocReadKey", permissions="documents:read")
        write_key = APIKey.objects.create(organization=org, name="WriteKey", permissions="write")
        admin_key = APIKey.objects.create(organization=org, name="AdminKey", permissions="admin")
        admin_wildcard_key = APIKey.objects.create(organization=org, name="AdminWildcardKey", permissions="admin:*")

        perm_org = CanAccessOrg()
        perm_members = CanAccessMembers()
        perm_billing = CanAccessBilling()
        perm_admin = IsAdminOrOwner()

        def make_req(k):
            r = MagicMock()
            r.api_key = k
            r.organization = org
            return r

        # Non-admin keys MUST NOT have access to org, members, or billing data
        for k in [query_key, doc_write_key, doc_read_key, write_key]:
            req = make_req(k)
            assert perm_org.has_permission(req, None) is False, f"Key {k.permissions} should not access org info"
            assert perm_members.has_permission(req, None) is False, f"Key {k.permissions} should not access members"
            assert perm_billing.has_permission(req, None) is False, f"Key {k.permissions} should not access billing"
            assert perm_admin.has_permission(req, None) is False, f"Key {k.permissions} should not have admin role"

        # Admin keys MUST have access to org, members, and billing data
        for k in [admin_key, admin_wildcard_key]:
            req = make_req(k)
            assert perm_org.has_permission(req, None) is True, f"Admin key {k.permissions} should access org info"
            assert perm_members.has_permission(req, None) is True, f"Admin key {k.permissions} should access members"
            assert perm_billing.has_permission(req, None) is True, f"Admin key {k.permissions} should access billing"
            assert perm_admin.has_permission(req, None) is True, f"Admin key {k.permissions} should have admin role"


class TestTokenRateLimiting:
    def test_tpm_accumulation_and_limit(self):
        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe

        with patch("middleware.redis_utils.get_redis_client", return_value=mock_redis):
            # Test recording token usage
            record_token_usage("test_org", "test_key", 500)
            mock_pipe.incrby.assert_called_once()
            mock_pipe.execute.assert_called_once()

            # Test check_token_rate_limit under limit
            mock_redis.get.return_value = "5000"
            allowed, remaining, reset, curr = check_token_rate_limit("test_org", "test_key", limit=10000)
            assert allowed is True
            assert remaining == 5000
            assert curr == 5000

            # Test check_token_rate_limit over limit
            mock_redis.get.return_value = "12000"
            allowed, remaining, reset, curr = check_token_rate_limit("test_org", "test_key", limit=10000)
            assert allowed is False
            assert remaining == 0
            assert curr == 12000


@pytest.mark.django_db
class TestMeteredAttribution:
    def test_usage_attribution_by_api_key(self, db):
        plan = Plan.objects.create(name="Pro", monthly_request_limit=1000, price=29)
        org = Organization.objects.create(name="AttrOrg", plan=plan)
        key1 = APIKey.objects.create(organization=org, name="PipelineKey", permissions="write")
        key2 = APIKey.objects.create(organization=org, name="ChatbotKey", permissions="rag:query")

        # Create usage logs attributed to keys
        UsageLog.objects.create(
            organization=org,
            api_key=key1,
            endpoint="/api/ai/documents/upload/",
            model_used="embedding:all-MiniLM-L6-v2",
            input_tokens=1500,
            output_tokens=0,
            estimated_cost=Decimal("0.000030"),
        )
        UsageLog.objects.create(
            organization=org,
            api_key=key2,
            endpoint="/api/ai/query/",
            model_used="gemini-2.5-flash",
            input_tokens=200,
            output_tokens=400,
            estimated_cost=Decimal("0.000150"),
        )

        from billing.views import BillingUsageView
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/api/billing/usage/")
        request.organization = org
        request.user = None

        view = BillingUsageView()
        response = view.get(request)
        assert response.status_code == 200
        data = response.data

        assert "by_api_key" in data
        by_key = {item["name"]: item for item in data["by_api_key"]}
        assert "PipelineKey" in by_key
        assert by_key["PipelineKey"]["input_tokens"] == 1500
        assert "ChatbotKey" in by_key
        assert by_key["ChatbotKey"]["total_tokens"] == 600


@pytest.mark.django_db
class TestEndpointsWithScopedKeys:
    def test_endpoint_responses_by_scope(self, db):
        from rest_framework.test import APIClient
        from accounts.models import User, Membership
        plan = Plan.objects.create(name="Pro", monthly_request_limit=1000, price=29)
        org = Organization.objects.create(name="E2EOrg", plan=plan)
        user = User.objects.create_user(email="owner@test.com", password="password123", is_verified=True)
        Membership.objects.create(organization=org, user=user, role="owner", is_active=True)

        query_key = APIKey.objects.create(organization=org, name="QueryKey", permissions="rag:query")
        raw_query_key = getattr(query_key, "_raw_key")

        admin_key = APIKey.objects.create(organization=org, name="AdminKey", permissions="admin")
        raw_admin_key = getattr(admin_key, "_raw_key")

        client = APIClient()

        with patch("middleware.redis_utils.check_rate_limit", return_value=(True, 100, 100)):
            # 1. Query Key:
            # Org endpoints should return 403 Forbidden
            res = client.get("/api/org/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            res = client.get("/api/org/members/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            # Billing endpoints should return 403 Forbidden
            res = client.get("/api/billing/usage/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            res = client.get("/api/billing/plan/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            res = client.get("/api/keys/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            # AI documents read should return 200 OK
            res = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 200

            # AI documents write should return 403 Forbidden
            res = client.post("/api/ai/documents/", {"title": "Test Doc"}, HTTP_AUTHORIZATION=f"Bearer {raw_query_key}")
            assert res.status_code == 403

            # 2. Document Write Key:
            doc_write_key = APIKey.objects.create(organization=org, name="DocWriteKey", permissions="documents:write")
            raw_doc_write_key = getattr(doc_write_key, "_raw_key")

            # Document upload should succeed (201 Created)
            res = client.post("/api/ai/documents/", {"title": "Ingested Doc"}, HTTP_AUTHORIZATION=f"Bearer {raw_doc_write_key}")
            assert res.status_code == 201

            # Document read should succeed (200 OK)
            res = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_write_key}")
            assert res.status_code == 200

            # Org & billing access must be forbidden (403 Forbidden)
            res = client.get("/api/org/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_write_key}")
            assert res.status_code == 403
            res = client.get("/api/billing/usage/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_write_key}")
            assert res.status_code == 403
            res = client.get("/api/keys/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_write_key}")
            assert res.status_code == 403

            # 3. Document Read Key:
            doc_read_key = APIKey.objects.create(organization=org, name="DocReadKey", permissions="documents:read")
            raw_doc_read_key = getattr(doc_read_key, "_raw_key")

            # Document read should succeed (200 OK)
            res = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_read_key}")
            assert res.status_code == 200

            # Document upload must be forbidden (403 Forbidden)
            res = client.post("/api/ai/documents/", {"title": "Blocked Doc"}, HTTP_AUTHORIZATION=f"Bearer {raw_doc_read_key}")
            assert res.status_code == 403

            # Org & billing access must be forbidden (403 Forbidden)
            res = client.get("/api/org/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_read_key}")
            assert res.status_code == 403
            res = client.get("/api/billing/usage/", HTTP_AUTHORIZATION=f"Bearer {raw_doc_read_key}")
            assert res.status_code == 403

            # 4. Full Access Write Key (write):
            write_key = APIKey.objects.create(organization=org, name="WriteKey", permissions="write")
            raw_write_key = getattr(write_key, "_raw_key")

            # AI operations should succeed
            res = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 200
            res = client.post("/api/ai/documents/", {"title": "Write Key Doc"}, HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 201

            # Gated org & billing data must be forbidden (403 Forbidden)
            res = client.get("/api/org/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 403
            res = client.get("/api/org/members/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 403
            res = client.get("/api/billing/usage/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 403
            res = client.get("/api/billing/plan/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 403
            res = client.get("/api/keys/", HTTP_AUTHORIZATION=f"Bearer {raw_write_key}")
            assert res.status_code == 403

            # 5. Admin Key (admin & admin:*):
            # Org endpoints should return 200 OK
            res = client.get("/api/org/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200
            assert res.data["name"] == "E2EOrg"

            res = client.get("/api/org/members/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200

            # Billing endpoints should return 200 OK
            res = client.get("/api/billing/usage/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200

            res = client.get("/api/billing/plan/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200

            res = client.get("/api/keys/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200

            # AI endpoints should also work for admin
            res = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 200
            res = client.post("/api/ai/documents/", {"title": "Admin Doc"}, HTTP_AUTHORIZATION=f"Bearer {raw_admin_key}")
            assert res.status_code == 201

            # 6. Human User Web Session:
            # Owner session
            client.force_authenticate(user=user)
            res = client.get("/api/org/")
            assert res.status_code == 200
            res = client.get("/api/org/members/")
            assert res.status_code == 200
            res = client.get("/api/billing/usage/")
            assert res.status_code == 200
            res = client.get("/api/keys/")
            assert res.status_code == 200

            # Member user session
            member_user = User.objects.create_user(email="member@test.com", password="password123", is_verified=True)
            Membership.objects.create(organization=org, user=member_user, role="member", is_active=True)
            client.force_authenticate(user=member_user)

            res = client.get("/api/org/")
            assert res.status_code == 200
            res = client.get("/api/org/members/")
            assert res.status_code == 200
            res = client.get("/api/billing/usage/")
            assert res.status_code == 200
            # Regular members cannot manage API keys
            res = client.get("/api/keys/")
            assert res.status_code == 403
