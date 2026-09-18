import pytest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from accounts.models import Organization, Membership
from billing.models import Plan, APIKey, UsageAggregate
from ai_service.models import Document, DocumentChunk, AIQuery
from ai_service.services.rag_orchestrator import RAGOrchestrator
from ai_service.services.semantic_cache import SemanticCache, get_cache_ttl
from ai_service.services.model_router import ModelRouter, CircuitBreaker
from ai_service.services.document_store import DjangoDocumentStore
from django.utils import timezone
from datetime import timedelta
import time

User = get_user_model()


@pytest.mark.django_db
class TestSemanticCache:
    def test_cache_store_and_lookup(self, org_a):
        cache = SemanticCache(org_a)
        import numpy as np
        query_emb = np.array([0.1] * 384, dtype=np.float32)
        cache.store("what is AI", query_emb, "AI is artificial intelligence", "gemini-2.0-flash")
        result = cache.lookup(query_emb, "what is AI")
        assert result is not None
        assert result["answer"] == "AI is artificial intelligence"
        assert result["cache_hit"] is True

    def test_cache_miss_different_query(self, org_a):
        cache = SemanticCache(org_a)
        import numpy as np
        emb1 = np.array([0.1] * 384, dtype=np.float32)
        emb2 = np.array([-0.1] * 384, dtype=np.float32)
        cache.store("what is AI", emb1, "AI is artificial intelligence", "gemini-2.0-flash")
        result = cache.lookup(emb2, "what is ML")
        assert result is None

    def test_cache_clear(self, org_a):
        cache = SemanticCache(org_a)
        import numpy as np
        cache.store("q1", np.array([0.1] * 384), "a1", "m")
        cache.clear()
        stats = cache.get_stats()
        assert stats["total_entries"] == 0

    def test_cache_ttl_free_plan(self, free_plan):
        org = Organization.objects.create(name="Free Org", slug="free-org", plan=free_plan)
        assert get_cache_ttl(org) == 3600

    def test_cache_ttl_pro_plan(self, pro_plan):
        org = Organization.objects.create(name="Pro Org", slug="pro-org", plan=pro_plan)
        assert get_cache_ttl(org) == 86400

    def test_cache_ttl_enterprise_plan(self, enterprise_plan):
        org = Organization.objects.create(name="Ent Org", slug="ent-org", plan=enterprise_plan)
        assert get_cache_ttl(org) == 604800


@pytest.mark.django_db
class TestModelRouter:
    def test_fallback_chain(self, routing_rule_free):
        router = ModelRouter(routing_rule_free.plan.organization_set.first() or Organization.objects.first())
        route = router.get_route()
        assert route["primary"] is not None
        assert len(route["fallbacks"]) > 0

    def test_circuit_breaker_opens(self):
        cb = CircuitBreaker(failure_threshold=2, window_seconds=60)
        assert cb.is_open("model-x") is False
        cb.record_failure("model-x")
        assert cb.is_open("model-x") is False
        cb.record_failure("model-x")
        assert cb.is_open("model-x") is True

    def test_circuit_breaker_resets(self):
        cb = CircuitBreaker(failure_threshold=2, window_seconds=1)
        cb.record_failure("model-x")
        cb.record_failure("model-x")
        assert cb.is_open("model-x") is True
        time.sleep(1.1)
        assert cb.is_open("model-x") is False


@pytest.mark.django_db
class TestDocumentStore:
    def test_add_and_search_documents(self, org_a):
        from rag.embedder import Embedder
        embedder = Embedder()
        store = DjangoDocumentStore(org_a, embedder)
        doc = Document.objects.create(organization=org_a, filename="test.txt", status="ready")
        chunks = ["This is test chunk one.", "This is test chunk two.", "This is test chunk three."]
        count = store.add_document(str(doc.id), chunks)
        assert count == 3
        query_emb = embedder.encode("test chunk")
        results = store.search(query_emb, top_k=2)
        assert len(results) > 0
        assert "chunk_id" in results[0]
        assert "score" in results[0]
        assert "text" in results[0]

    def test_delete_document(self, org_a):
        from rag.embedder import Embedder
        embedder = Embedder()
        store = DjangoDocumentStore(org_a, embedder)
        doc = Document.objects.create(organization=org_a, filename="del.txt", status="ready")
        store.add_document(str(doc.id), ["delete me"])
        assert Document.objects.filter(id=doc.id).exists()
        deleted = store.delete_document("del.txt")
        assert deleted >= 0

    def test_list_documents(self, org_a):
        from rag.embedder import Embedder
        embedder = Embedder()
        store = DjangoDocumentStore(org_a, embedder)
        Document.objects.create(organization=org_a, filename="doc1.txt", status="ready")
        docs = store.list_documents()
        assert "doc1.txt" in docs


@pytest.mark.django_db
class TestQuotaEnforcement:
    def test_monthly_limit_enforced(self, org_a):
        org_a.plan.monthly_request_limit = 1
        org_a.plan.save()
        for i in range(1):
            agg, _ = UsageAggregate.objects.get_or_create(
                organization=org_a,
                month=timezone.now().strftime("%Y-%m"),
                defaults={"date": timezone.now().date(), "total_requests": 0},
            )
        from middleware.usage_limit import MonthlyLimitExceeded
        from rest_framework.exceptions import APIException
        assert MonthlyLimitExceeded.status_code == 402
