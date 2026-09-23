import pytest
from django.utils import timezone
from datetime import timedelta
from unittest.mock import MagicMock, patch
from accounts.models import Organization
from ai_service.models import AIQuery
from ai_service.services.rag_orchestrator import RAGOrchestrator


@pytest.mark.django_db
class TestConversationalContextUnit:
    """
    Unit tests covering various scenarios of conversational context in RAGOrchestrator.
    """

    def test_build_prompt_without_history(self, org_a, owner_a):
        """Scenario 1: Initial query without history contains no previous conversation block."""
        orchestrator = RAGOrchestrator(organization=org_a, user=owner_a)
        chunks = [{"doc_title": "Doc1", "chunk_index": 0, "score": 0.85, "text": "Refunds are processed within 14 days."}]
        system_prompt, user_prompt = orchestrator._build_prompt("What is the refund policy?", chunks)

        assert "Previous Conversation Context:" not in user_prompt
        assert "Refunds are processed within 14 days." in user_prompt
        assert "Question: What is the refund policy?" in user_prompt

    def test_build_prompt_with_explicit_history(self, org_a, owner_a):
        """Scenario 2: Follow-up query with history formats conversation turns and truncates long answers."""
        orchestrator = RAGOrchestrator(organization=org_a, user=owner_a)
        chunks = [{"doc_title": "Doc1", "chunk_index": 1, "score": 0.90, "text": "Late penalties are 5% per month."}]
        history = [
            {"question": "What is the invoice payment cycle?", "answer": "Invoices are due on Net 30 terms from issuance date."},
            {"question": "Does this apply to international vendors?", "answer": "A" * 600},  # Test truncation > 400 chars
        ]
        system_prompt, user_prompt = orchestrator._build_prompt("What about the penalties?", chunks, history)

        assert "Previous Conversation Context:" in user_prompt
        assert "User: What is the invoice payment cycle?" in user_prompt
        assert "AI: Invoices are due on Net 30 terms from issuance date." in user_prompt
        assert "User: Does this apply to international vendors?" in user_prompt
        # Check truncation indicator
        assert "..." in user_prompt
        assert "Context from uploaded documents:" in user_prompt
        assert "Late penalties are 5% per month." in user_prompt
        assert "Question: What about the penalties?" in user_prompt

    def test_get_search_query_standalone_vs_referential(self, org_a, owner_a):
        """Scenario 3: Verify search query formulation for standalone vs referential questions."""
        orchestrator = RAGOrchestrator(organization=org_a, user=owner_a)
        history = [
            {"question": "What are the payment terms in the Acme contract?", "answer": "Net 30 days."}
        ]

        # 3a. Standalone question: should NOT merge with history
        standalone_q = "What is the official office headquarters address?"
        assert orchestrator._get_search_query(standalone_q, history) == standalone_q

        # 3b. Referential question with pronoun 'they': should merge with previous question
        referential_q1 = "What if they are late?"
        res1 = orchestrator._get_search_query(referential_q1, history)
        assert "What are the payment terms in the Acme contract?" in res1
        assert "What if they are late?" in res1

        # 3c. Referential question with 'what about': should merge
        referential_q2 = "What about the penalties?"
        res2 = orchestrator._get_search_query(referential_q2, history)
        assert "What are the payment terms in the Acme contract?" in res2
        assert "What about the penalties?" in res2

        # 3d. Empty history: returns question as-is
        assert orchestrator._get_search_query(referential_q1, []) == referential_q1
        assert orchestrator._get_search_query(referential_q1, None) == referential_q1

    def test_automatic_db_history_lookup(self, org_a, owner_a):
        """Scenario 4: When conversation_history=None, recent AIQuery records are auto-fetched."""
        now = timezone.now()
        # Create 2 recent queries within 15 minutes
        AIQuery.objects.create(
            organization=org_a,
            user=owner_a,
            query_text="What is the vacation policy?",
            response_text="Employees receive 20 days paid vacation annually.",
            model_used="test-model",
            created_at=now - timedelta(minutes=5),
        )
        AIQuery.objects.create(
            organization=org_a,
            user=owner_a,
            query_text="How many can be rolled over?",
            response_text="Up to 5 unused days can be carried over.",
            model_used="test-model",
            created_at=now - timedelta(minutes=2),
        )

        orchestrator = RAGOrchestrator(organization=org_a, user=owner_a)

        # Mock LLMClient so we can inspect the generated prompt without calling external APIs
        with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
            mock_instance = MagicMock()
            mock_instance.generate.return_value = {
                "answer": "Yes, rollover must be approved.",
                "model": "gemini-2.5-flash",
                "provider": "gemini",
                "latency_ms": 100,
                "input_tokens": 50,
                "output_tokens": 10,
                "estimated_cost": 0.0001,
            }
            MockLLM.return_value = mock_instance

            # Call without passing history (conversation_history=None)
            orchestrator.query("Does manager approval apply to that?")

            # Inspect user_prompt passed to llm_client.generate
            called_args = mock_instance.generate.call_args
            sys_prompt, user_prompt = called_args[0][0], called_args[0][1]

            assert "Previous Conversation Context:" in user_prompt
            assert "User: What is the vacation policy?" in user_prompt
            assert "User: How many can be rolled over?" in user_prompt

    def test_explicit_empty_history_clears_context(self, org_a, owner_a):
        """Scenario 5: When conversation_history=[] is explicitly passed, DB history is bypassed."""
        now = timezone.now()
        AIQuery.objects.create(
            organization=org_a,
            user=owner_a,
            query_text="Old context query",
            response_text="Old response",
            model_used="test-model",
            created_at=now - timedelta(minutes=2),
        )

        orchestrator = RAGOrchestrator(organization=org_a, user=owner_a)

        with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
            mock_instance = MagicMock()
            mock_instance.generate.return_value = {
                "answer": "Fresh answer",
                "model": "gemini-2.5-flash",
                "provider": "gemini",
                "latency_ms": 100,
                "input_tokens": 20,
                "output_tokens": 5,
                "estimated_cost": 0.0001,
            }
            MockLLM.return_value = mock_instance

            # Explicit empty list means context cleared / reset
            orchestrator.query("New topic without context", conversation_history=[])

            called_args = mock_instance.generate.call_args
            user_prompt = called_args[0][1]

            assert "Previous Conversation Context:" not in user_prompt
            assert "Old context query" not in user_prompt

    def test_cross_tenant_isolation_in_context(self, org_a, org_b, owner_a, owner_b):
        """Scenario 6: Organization A's query history is never leaked into Organization B's context."""
        now = timezone.now()
        # Org A has queries
        AIQuery.objects.create(
            organization=org_a,
            user=owner_a,
            query_text="Secret Org A contract detail",
            response_text="Org A confidential project Pegasus is launching in Q4.",
            model_used="test-model",
            created_at=now - timedelta(minutes=2),
        )

        # User in Org B queries with no history passed
        orchestrator_b = RAGOrchestrator(organization=org_b, user=owner_b)

        with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
            mock_instance = MagicMock()
            mock_instance.generate.return_value = {
                "answer": "Org B answer",
                "model": "gemini-2.5-flash",
                "provider": "gemini",
                "latency_ms": 100,
                "input_tokens": 20,
                "output_tokens": 5,
                "estimated_cost": 0.0001,
            }
            MockLLM.return_value = mock_instance

            orchestrator_b.query("What projects are in flight?")

            called_args = mock_instance.generate.call_args
            user_prompt = called_args[0][1]

            # Ensure Org A's confidential context is strictly absent
            assert "Secret Org A contract detail" not in user_prompt
            assert "Pegasus" not in user_prompt
