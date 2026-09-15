import pytest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from accounts.models import Organization, Membership
from billing.models import Plan, APIKey
from ai_service.models import Document, AIQuery
from ai_service.views import AIQueryView
from ai_service.services.rag_orchestrator import RAGOrchestrator

User = get_user_model()


def _login(api_client, user):
    response = api_client.post("/api/auth/login/", {
        "email": user.email,
        "password": "pass123",
    }, format="json")
    assert response.status_code == 200
    access = response.data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")


@pytest.mark.django_db
class TestAIQueryFlow:
    def test_query_requires_auth(self, api_client):
        response = api_client.post("/api/ai/query/", {"question": "test"}, format="json")
        assert response.status_code == 401

    def test_query_returns_metadata(self, api_client, org_a, owner_a):
        _login(api_client, owner_a)
        response = api_client.post("/api/ai/query/", {"question": "test"}, format="json")
        assert response.status_code in [200, 503]
        if response.status_code == 200:
            assert "answer" in response.data
            assert "model" in response.data
            assert "provider" in response.data
            assert "input_tokens" in response.data
            assert "output_tokens" in response.data
            assert "latency_ms" in response.data
            assert "estimated_cost" in response.data
            assert "cache_hit" in response.data
            assert "request_id" in response.data

    def test_query_history_returns_recent(self, api_client, org_a, owner_a):
        _login(api_client, owner_a)
        for i in range(5):
            AIQuery.objects.create(
                organization=org_a,
                user=owner_a,
                query_text=f"q{i}",
                response_text=f"r{i}",
                model_used="m",
            )
        response = api_client.get("/api/ai/history/?limit=3")
        assert response.status_code == 200
        assert len(response.data["results"]) == 3

    def test_document_upload_and_list(self, api_client, org_a, owner_a):
        _login(api_client, owner_a)
        response = api_client.post("/api/ai/documents/", {
            "filename": "test.txt",
        }, format="multipart")
        assert response.status_code == 201
        doc_id = response.data["id"]
        response = api_client.get("/api/ai/documents/")
        assert response.status_code == 200
        assert len(response.data) >= 1
