import os
import sys
from pathlib import Path
import django

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Setup Django test environment
os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
django.setup()

from django.test.utils import setup_test_environment, teardown_test_environment
from django.db import connection
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from unittest.mock import MagicMock, patch

setup_test_environment()
# Run migrations on test sqlite db
call_command("migrate", verbosity=0)

from accounts.models import Organization, User, Membership
from billing.models import Plan
from ai_service.models import AIQuery
from ai_service.services.rag_orchestrator import RAGOrchestrator

def run_all_scenarios():
    print("=" * 60)
    print("STARTING SCENARIO TESTS FOR CONVERSATIONAL CONTEXT IN RAG")
    print("=" * 60)

    # Setup test plan and orgs
    plan, _ = Plan.objects.get_or_create(
        name="pro",
        defaults={
            "monthly_request_limit": 1000,
            "requests_per_minute": 60,
            "cache_ttl_seconds": 86400,
            "price": 29,
        }
    )

    org_a, _ = Organization.objects.get_or_create(name="Org A Context", slug="org-a-context", defaults={"plan": plan})
    user_a, _ = User.objects.get_or_create(email="user_ctx_a@test.ai", defaults={"is_verified": True})
    user_a.set_password("pass123")
    user_a.save()
    Membership.objects.get_or_create(user=user_a, organization=org_a, defaults={"role": "owner"})

    org_b, _ = Organization.objects.get_or_create(name="Org B Context", slug="org-b-context", defaults={"plan": plan})
    user_b, _ = User.objects.get_or_create(email="user_ctx_b@test.ai", defaults={"is_verified": True})
    user_b.set_password("pass123")
    user_b.save()
    Membership.objects.get_or_create(user=user_b, organization=org_b, defaults={"role": "owner"})

    # ---------------------------------------------------------
    # Scenario 1: Initial query without history
    # ---------------------------------------------------------
    print("\n[Scenario 1] Testing _build_prompt without history...")
    orchestrator = RAGOrchestrator(organization=org_a, user=user_a)
    chunks = [{"doc_title": "Handbook.pdf", "chunk_index": 0, "score": 0.88, "text": "Annual leave is 20 days per calendar year."}]
    _, user_prompt = orchestrator._build_prompt("What is the annual leave policy?", chunks)
    assert "Previous Conversation Context:" not in user_prompt, "Previous Conversation Context should NOT appear when history is absent"
    assert "Annual leave is 20 days per calendar year." in user_prompt, "Document context chunk must be present"
    assert "Question: What is the annual leave policy?" in user_prompt
    print("  -> PASSED: Single-turn query prompt correctly formats without history block.")

    # ---------------------------------------------------------
    # Scenario 2: Follow-up query with explicit conversation history
    # ---------------------------------------------------------
    print("\n[Scenario 2] Testing _build_prompt with explicit conversation history...")
    history = [
        {"question": "What is the annual leave policy?", "answer": "Annual leave is 20 days per calendar year."},
        {"question": "Can I take more than 2 weeks consecutively?", "answer": "Yes, with manager approval in writing."}
    ]
    chunks = [{"doc_title": "Handbook.pdf", "chunk_index": 1, "score": 0.92, "text": "Unused leave carries over up to 5 days into Q1."}]
    _, user_prompt = orchestrator._build_prompt("What happens to unused leave at year end?", chunks, history)
    assert "Previous Conversation Context:" in user_prompt, "Previous Conversation Context block must be present"
    assert "User: What is the annual leave policy?" in user_prompt
    assert "AI: Annual leave is 20 days per calendar year." in user_prompt
    assert "User: Can I take more than 2 weeks consecutively?" in user_prompt
    assert "AI: Yes, with manager approval in writing." in user_prompt
    assert "Unused leave carries over up to 5 days into Q1." in user_prompt
    assert "Question: What happens to unused leave at year end?" in user_prompt
    print("  -> PASSED: Multi-turn prompt accurately injects prior Q&A turns alongside document context.")

    # ---------------------------------------------------------
    # Scenario 3: Contextual search query formulation (standalone vs referential)
    # ---------------------------------------------------------
    print("\n[Scenario 3] Testing _get_search_query formulation...")
    history = [
        {"question": "What are the payment terms in the Vendor SLA?", "answer": "Invoices are payable within 30 days."}
    ]

    # 3a: Standalone query should NOT merge
    standalone = "Where is the data center located?"
    assert orchestrator._get_search_query(standalone, history) == standalone, "Standalone query should not be modified"
    print("  -> PASSED (3a): Standalone question remains unmodified.")

    # 3b: Referential query with pronoun 'they'
    referential_pronoun = "What if they are late?"
    res_pronoun = orchestrator._get_search_query(referential_pronoun, history)
    assert "What are the payment terms in the Vendor SLA?" in res_pronoun
    assert "What if they are late?" in res_pronoun
    print(f"  -> PASSED (3b): Referential question with pronoun correctly merged: '{res_pronoun}'")

    # 3c: Referential query with 'what about'
    referential_whatabout = "What about the penalties?"
    res_whatabout = orchestrator._get_search_query(referential_whatabout, history)
    assert "What are the payment terms in the Vendor SLA?" in res_whatabout
    assert "What about the penalties?" in res_whatabout
    print(f"  -> PASSED (3c): 'What about' question correctly merged: '{res_whatabout}'")

    # 3d: Empty history
    assert orchestrator._get_search_query(referential_pronoun, []) == referential_pronoun
    assert orchestrator._get_search_query(referential_pronoun, None) == referential_pronoun
    print("  -> PASSED (3d): Empty history preserves original query unmodified.")

    # ---------------------------------------------------------
    # Scenario 4: Automatic DB history fallback for authenticated user
    # ---------------------------------------------------------
    print("\n[Scenario 4] Testing automatic DB query history lookup when conversation_history is None...")
    from ai_service.models import CacheEntry
    CacheEntry.objects.all().delete()
    now = timezone.now()
    AIQuery.objects.filter(organization=org_a).delete()
    AIQuery.objects.create(
        organization=org_a,
        user=user_a,
        query_text="What is the server maintenance window?",
        response_text="Maintenance is scheduled on Sundays from 2am to 4am UTC.",
        model_used="gemini-2.5-flash",
        created_at=now - timedelta(minutes=4),
    )
    AIQuery.objects.create(
        organization=org_a,
        user=user_a,
        query_text="Will API access be interrupted during that time?",
        response_text="API traffic will experience brief intermittent pauses of under 60 seconds.",
        model_used="gemini-2.5-flash",
        created_at=now - timedelta(minutes=1),
    )

    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "Yes, we send an email notification 48 hours in advance.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 90,
            "input_tokens": 40,
            "output_tokens": 12,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        # Call query with conversation_history=None (default)
        orchestrator.query("Is advance email notice sent before that?")

        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]

        assert "Previous Conversation Context:" in user_prompt, "Auto-fetched DB history must be injected into user prompt"
        assert "User: What is the server maintenance window?" in user_prompt
        assert "User: Will API access be interrupted during that time?" in user_prompt
        print("  -> PASSED: RAGOrchestrator successfully resolved recent DB queries into prompt context.")

    # ---------------------------------------------------------
    # Scenario 5: Explicit empty history resets/clears context
    # ---------------------------------------------------------
    print("\n[Scenario 5] Testing explicit conversation_history=[] (clearing context)...")
    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "New standalone response.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 80,
            "input_tokens": 20,
            "output_tokens": 5,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        orchestrator.query("Unrelated fresh question", conversation_history=[])

        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]

        assert "Previous Conversation Context:" not in user_prompt, "Context should be empty when explicitly passed []"
        assert "What is the server maintenance window?" not in user_prompt
        print("  -> PASSED: Explicit empty history clears conversational context.")

    # ---------------------------------------------------------
    # Scenario 6: Strict Cross-tenant isolation
    # ---------------------------------------------------------
    print("\n[Scenario 6] Testing cross-tenant isolation (Org A queries NEVER leak to Org B)...")
    AIQuery.objects.create(
        organization=org_a,
        user=user_a,
        query_text="Org A confidential project Falcon",
        response_text="Project Falcon is scheduled for secret release next month.",
        model_used="gemini-2.5-flash",
        created_at=timezone.now() - timedelta(minutes=2),
    )

    orchestrator_b = RAGOrchestrator(organization=org_b, user=user_b)
    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "Org B answer.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 70,
            "input_tokens": 20,
            "output_tokens": 5,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        # Org B asks a query without history
        orchestrator_b.query("What confidential projects exist?")

        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]

        assert "Project Falcon" not in user_prompt, "CRITICAL: Org A confidential data must not leak to Org B"
        assert "Org A confidential" not in user_prompt
        print("  -> PASSED: Cross-tenant isolation verified; Org A context completely isolated from Org B.")

    # ---------------------------------------------------------
    # Scenario 7: RAGPipeline.ask method verification
    # ---------------------------------------------------------
    print("\n[Scenario 7] Testing RAGPipeline.ask with conversation_history...")
    from rag.pipeline import RAGPipeline

    mock_embedder = MagicMock()
    mock_embedder.encode.return_value = [0.1] * 384
    mock_doc_store = MagicMock()
    mock_doc_store.search.return_value = [{"text": "Refunds take 5-7 business days."}]
    mock_generator = MagicMock()
    mock_generator.generate.return_value = "Refunds take 5-7 business days."
    mock_generator.model_name = "test-model"
    mock_generator.provider = "test-provider"

    pipeline = RAGPipeline(
        embedder=mock_embedder,
        document_store=mock_doc_store,
        generator=mock_generator,
        chunker=MagicMock(),
    )

    pipeline_history = [
        {"question": "How do I request a refund?", "answer": "Go to billing settings and click refund."}
    ]
    res = pipeline.ask("How long does it take?", conversation_history=pipeline_history)
    assert res["answer"] == "Refunds take 5-7 business days."
    # Check that search query merged
    search_call_args = mock_doc_store.search.call_args
    assert "How do I request a refund?" in search_call_args[1]["query_text"]
    assert "How long does it take?" in search_call_args[1]["query_text"]
    print("  -> PASSED: RAGPipeline.ask properly enriches search and passes context.")

    # ---------------------------------------------------------
    # Scenario 8: Serializer validation verification
    # ---------------------------------------------------------
    print("\n[Scenario 8] Testing AIQueryRequestSerializer validation...")
    from ai_service.serializers import AIQueryRequestSerializer

    # 8a: Without conversation_history
    s1 = AIQueryRequestSerializer(data={"question": "Test query"})
    assert s1.is_valid(), s1.errors
    assert s1.validated_data.get("conversation_history") is None

    # 8b: With valid conversation_history
    s2 = AIQueryRequestSerializer(data={
        "question": "What about the second one?",
        "conversation_history": [
            {"question": "List option 1 and option 2", "answer": "Option 1 is Free, Option 2 is Pro"}
        ]
    })
    assert s2.is_valid(), s2.errors
    assert len(s2.validated_data["conversation_history"]) == 1
    print("  -> PASSED: Serializer correctly validates and parses conversation_history.")

    # ---------------------------------------------------------
    # Scenario 9: API Key authentication query with context
    # ---------------------------------------------------------
    print("\n[Scenario 9] Testing API Key queries with both explicit history and key-scoped DB fallback...")
    CacheEntry.objects.all().delete()
    from billing.models import APIKey
    key_a, _ = APIKey.objects.get_or_create(organization=org_a, name="Test Key A", defaults={"permissions": "write"})

    # 9a: Explicit history passed with API Key
    orchestrator_key = RAGOrchestrator(organization=org_a, api_key=key_a)
    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "Net 30 days.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 50,
            "input_tokens": 30,
            "output_tokens": 10,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        orchestrator_key.query(
            "What if they are late?",
            conversation_history=[{"question": "What are invoice terms?", "answer": "Invoices are due upon receipt."}]
        )
        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]
        assert "Previous Conversation Context:" in user_prompt
        assert "User: What are invoice terms?" in user_prompt
        print("  -> PASSED (9a): API Key caller sending explicit conversation_history receives contextual prompt.")

    # 9b: Auto DB fallback scoped to API Key
    AIQuery.objects.create(
        organization=org_a,
        api_key=key_a,
        query_text="API Key Turn 1",
        response_text="API Key Answer 1",
        model_used="gemini-2.5-flash",
        created_at=timezone.now() - timedelta(minutes=1),
    )
    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "API Key Answer 2.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 50,
            "input_tokens": 30,
            "output_tokens": 10,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        # Call with conversation_history=None
        orchestrator_key.query("API Key Turn 2")
        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]
        assert "User: API Key Turn 1" in user_prompt
        assert "AI: API Key Answer 1" in user_prompt
        print("  -> PASSED (9b): API Key caller without history receives key-scoped auto-context.")

    # ---------------------------------------------------------
    # Scenario 10: Automatic DB history prunes context when document is deleted
    # ---------------------------------------------------------
    print("\n[Scenario 10] Testing DB history auto-pruning when referenced document is deleted...")
    from ai_service.models import Document
    AIQuery.objects.filter(organization=org_a).delete()
    doc_confidential = Document.objects.create(
        organization=org_a,
        title="Confidential Policy",
        filename="confidential.txt",
        status=Document.STATUS_READY,
    )
    AIQuery.objects.create(
        organization=org_a,
        user=user_a,
        query_text="What is in the confidential policy?",
        response_text="The confidential policy contains proprietary trade secrets.",
        model_used="gemini-2.5-flash",
        source_doc_ids=[str(doc_confidential.id)],
        created_at=timezone.now() - timedelta(minutes=2),
    )

    # Delete the confidential document
    doc_confidential.delete()

    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "I do not have access to that document.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 40,
            "input_tokens": 15,
            "output_tokens": 8,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        # Query with conversation_history=None: auto-lookup should prune the deleted document's turn
        orchestrator.query("Tell me more about those trade secrets")
        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]

        assert "Previous Conversation Context:" not in user_prompt, "Context from deleted document must NOT appear in prompt"
        assert "What is in the confidential policy?" not in user_prompt, "Query text from deleted document must NOT appear"
        assert "proprietary trade secrets" not in user_prompt, "Answer text from deleted document must NOT appear"
        print("  -> PASSED: Context from deleted document was successfully excluded from auto-fetched history.")

    # ---------------------------------------------------------
    # Scenario 11: Explicit client conversation_history prunes deleted document turns
    # ---------------------------------------------------------
    print("\n[Scenario 11] Testing explicit conversation_history pruning for deleted document...")
    doc_temp = Document.objects.create(
        organization=org_a,
        title="Temporary Pricing",
        filename="pricing.txt",
        status=Document.STATUS_READY,
    )
    client_history = [
        {
            "question": "What is the beta price?",
            "answer": "The beta price is $10/mo.",
            "source_doc_ids": [str(doc_temp.id)],
        }
    ]
    # Delete the temporary document
    doc_temp.delete()

    with patch("ai_service.services.rag_orchestrator.LLMClient") as MockLLM:
        mock_instance = MagicMock()
        mock_instance.generate.return_value = {
            "answer": "Standard pricing applies.",
            "model": "gemini-2.5-flash",
            "provider": "gemini",
            "latency_ms": 40,
            "input_tokens": 20,
            "output_tokens": 5,
            "estimated_cost": 0.0001,
        }
        MockLLM.return_value = mock_instance

        orchestrator.query("Can you give me a discount on that?", conversation_history=client_history)
        called_args = mock_instance.generate.call_args
        user_prompt = called_args[0][1]

        assert "Previous Conversation Context:" not in user_prompt, "Deleted document turn must be pruned from client history"
        assert "What is the beta price?" not in user_prompt
        assert "The beta price is $10/mo." not in user_prompt
        print("  -> PASSED: Explicit client conversation_history properly pruned deleted document turns.")

    # ---------------------------------------------------------
    # Scenario 12: Referential query reformulation ignores deleted document questions
    # ---------------------------------------------------------
    print("\n[Scenario 12] Testing referential query rewriting guard against deleted documents...")
    doc_payroll = Document.objects.create(
        organization=org_a,
        title="Executive Payroll",
        filename="payroll.txt",
        status=Document.STATUS_READY,
    )
    deleted_history = [
        {
            "question": "What is the CEO compensation?",
            "answer": "Base salary is $500k.",
            "source_doc_ids": [str(doc_payroll.id)],
        }
    ]
    doc_payroll.delete()

    # Sanitize history
    clean_history = orchestrator._sanitize_conversation_history(deleted_history)
    assert len(clean_history) == 0, "Deleted document history turn must be pruned"

    # Referential follow-up query
    follow_up = "Can you elaborate on that?"
    search_q = orchestrator._get_search_query(follow_up, clean_history)
    assert search_q == follow_up, "Query rewriter must NOT merge with deleted document question"
    assert "CEO compensation" not in search_q, "Deleted document question must not contaminate search query"
    print(f"  -> PASSED: Referential query rewriting guarded; search query remains standalone: '{search_q}'.")

    # ---------------------------------------------------------
    # Scenario 13: Semantic cache invalidation on Document deletion
    # ---------------------------------------------------------
    print("\n[Scenario 13] Testing Semantic Cache invalidation upon Document deletion...")
    doc_cached = Document.objects.create(
        organization=org_a,
        title="Refund Policy",
        filename="refund.txt",
        status=Document.STATUS_READY,
    )
    dummy_vec = [0.05] * 384
    cache_entry = orchestrator.semantic_cache.store(
        "What is the refund window?",
        dummy_vec,
        "Refunds are permitted within 14 days.",
        "gemini-2.5-flash",
    )
    assert cache_entry is not None

    # Check cache hit before delete
    hit = orchestrator.semantic_cache.lookup(dummy_vec, "What is the refund window?")
    assert hit is not None, "Cache should hit before document deletion"
    assert hit["answer"] == "Refunds are permitted within 14 days."

    # Delete the document (triggers post_delete signal which flushes cache)
    doc_cached.delete()

    # Verify cache is cleared
    miss = orchestrator.semantic_cache.lookup(dummy_vec, "What is the refund window?")
    assert miss is None, "Cache lookup MUST be None (miss) after document deletion"
    from ai_service.models import CacheEntry
    assert CacheEntry.objects.filter(organization=org_a).count() == 0, "CacheEntry rows must be flushed on doc deletion"
    print("  -> PASSED: Semantic cache invalidated immediately upon Document deletion; zero stale cache leakage.")

    # ---------------------------------------------------------
    # Scenario 14: Multi-turn mixed document history preserves active doc context
    # ---------------------------------------------------------
    print("\n[Scenario 14] Testing mixed document history (prunes deleted, preserves active)...")
    doc_active = Document.objects.create(
        organization=org_a,
        title="Public FAQ",
        filename="faq.txt",
        status=Document.STATUS_READY,
    )
    doc_to_delete = Document.objects.create(
        organization=org_a,
        title="Retracted Memo",
        filename="memo.txt",
        status=Document.STATUS_READY,
    )
    mixed_history = [
        {
            "question": "What did the memo announce?",
            "answer": "The memo announced a merger.",
            "source_doc_ids": [str(doc_to_delete.id)],
        },
        {
            "question": "What are support business hours?",
            "answer": "Support is open 24/7.",
            "source_doc_ids": [str(doc_active.id)],
        },
    ]

    # Delete only the memo
    doc_to_delete.delete()

    sanitized = orchestrator._sanitize_conversation_history(mixed_history)
    assert len(sanitized) == 1, "Only active document turn should survive"
    assert sanitized[0]["question"] == "What are support business hours?"
    assert sanitized[0]["answer"] == "Support is open 24/7."
    print("  -> PASSED: Mixed history accurately pruned deleted doc turn while preserving active doc turn.")

    print("\n" + "=" * 60)
    print("ALL 14 SCENARIO TESTS (INCLUDING DOCUMENT DELETION SAFETY) PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_scenarios()
