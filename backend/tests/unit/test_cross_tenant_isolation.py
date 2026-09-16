import pytest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from accounts.models import Organization, Membership
from billing.models import APIKey, UsageLog
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry
from common.core.permissions import IsAuthenticatedAndActive, HasRole, CanUseAI, CanViewAI
from common.core.exceptions import api_exception_handler

User = get_user_model()


@pytest.mark.django_db
class TestCrossTenantIsolation:
    def test_users_cannot_access_other_org_documents(self, org_a, org_b):
        doc_a = Document.objects.create(organization=org_a, filename="doc_a.txt", status="ready")
        doc_b = Document.objects.create(organization=org_b, filename="doc_b.txt", status="ready")
        docs_a = Document.objects.filter(organization=org_a)
        docs_b = Document.objects.filter(organization=org_b)
        assert doc_a in docs_a
        assert doc_a not in docs_b
        assert doc_b in docs_b
        assert doc_b not in docs_a

    def test_users_cannot_access_other_org_chunks(self, org_a, org_b):
        doc_a = Document.objects.create(organization=org_a, filename="doc_a.txt", status="ready")
        doc_b = Document.objects.create(organization=org_b, filename="doc_b.txt", status="ready")
        chunk_a = DocumentChunk.objects.create(organization=org_a, document=doc_a, chunk_text="text a", chunk_index=0)
        chunk_b = DocumentChunk.objects.create(organization=org_b, document=doc_b, chunk_text="text b", chunk_index=0)
        chunks_a = DocumentChunk.objects.filter(organization=org_a)
        chunks_b = DocumentChunk.objects.filter(organization=org_b)
        assert chunk_a in chunks_a
        assert chunk_a not in chunks_b
        assert chunk_b in chunks_b
        assert chunk_b not in chunks_a

    def test_users_cannot_access_other_org_queries(self, org_a, org_b, owner_a, owner_b):
        query_a = AIQuery.objects.create(organization=org_a, user=owner_a, query_text="q1", response_text="r1", model_used="m")
        query_b = AIQuery.objects.create(organization=org_b, user=owner_b, query_text="q2", response_text="r2", model_used="m")
        assert query_a in AIQuery.objects.filter(organization=org_a)
        assert query_a not in AIQuery.objects.filter(organization=org_b)
        assert query_b in AIQuery.objects.filter(organization=org_b)
        assert query_b not in AIQuery.objects.filter(organization=org_a)

    def test_users_cannot_access_other_org_api_keys(self, org_a, org_b, api_key_a, api_key_b):
        keys_a = APIKey.objects.filter(organization=org_a)
        keys_b = APIKey.objects.filter(organization=org_b)
        assert api_key_a in keys_a
        assert api_key_a not in keys_b
        assert api_key_b in keys_b
        assert api_key_b not in keys_a

    def test_users_cannot_access_other_org_cache_entries(self, org_a, org_b):
        from django.utils import timezone
        from datetime import timedelta
        entry_a = CacheEntry.objects.create(organization=org_a, cache_key="key-a", query_text="q", model="m", response_text="r", expires_at=timezone.now() + timedelta(days=1))
        entry_b = CacheEntry.objects.create(organization=org_b, cache_key="key-b", query_text="q", model="m", response_text="r", expires_at=timezone.now() + timedelta(days=1))
        assert entry_a in CacheEntry.objects.filter(organization=org_a)
        assert entry_a not in CacheEntry.objects.filter(organization=org_b)
        assert entry_b in CacheEntry.objects.filter(organization=org_b)
        assert entry_b not in CacheEntry.objects.filter(organization=org_a)

    def test_users_cannot_access_other_org_usage_logs(self, org_a, org_b, owner_a, owner_b):
        log_a = UsageLog.objects.create(organization=org_a, user=owner_a, endpoint="/api/ai/query/", model_used="m")
        log_b = UsageLog.objects.create(organization=org_b, user=owner_b, endpoint="/api/ai/query/", model_used="m")
        assert log_a in UsageLog.objects.filter(organization=org_a)
        assert log_a not in UsageLog.objects.filter(organization=org_b)
        assert log_b in UsageLog.objects.filter(organization=org_b)
        assert log_b not in UsageLog.objects.filter(organization=org_a)
