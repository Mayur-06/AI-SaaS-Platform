import os
import sys
import django
import numpy as np

# Configure Django to use SQLite test settings (no external postgres or docker required)
os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
django.setup()

from django.core.management import call_command
call_command("migrate", verbosity=0)

from django.utils import timezone
from accounts.models import Organization
from billing.models import Plan
from ai_service.models import CacheEntry
from ai_service.services.semantic_cache import SemanticCache
from rag.embedder import Embedder


def cosine_similarity(vec_a, vec_b):
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def run_semantic_cache_test():
    print("=" * 80)
    print("TESTING SEMANTIC CACHING WITH NATURAL LANGUAGE SENTENCES")
    print("=" * 80)

    # 1. Initialize Embedder
    print("\n[Step 1] Initializing Sentence Transformer Embedder...")
    embedder = Embedder()
    print(f" Embedder ready. Model: {embedder.model_name}, Dimension: {embedder.embedding_dim}")

    # 2. Setup Test Organization
    print("\n[Step 2] Setting up Test Organization...")
    free_plan, _ = Plan.objects.get_or_create(
        name="free",
        defaults={"requests_per_minute": 10, "monthly_request_limit": 100, "price": 0}
    )
    org, _ = Organization.objects.get_or_create(
        slug="semantic-cache-test-org",
        defaults={
            "name": "Semantic Cache Test Org",
            "plan": free_plan,
            "cache_threshold": 0.85,
        }
    )
    org.cache_threshold = 0.85
    org.save(update_fields=["cache_threshold"])
    print(f" Organization: {org.name}, Cache Threshold: {org.cache_threshold}")

    # 3. Test Sentence Pairs Cosine Similarity
    print("\n[Step 3] Evaluating Vector Cosine Similarity Across Sentence Pairs:")
    base_query = "What is the return policy for damaged items?"
    variations = [
        ("Identical (case insensitive)", "what is the return policy for damaged items?"),
        ("Punctuation difference", "What is the return policy for damaged items"),
        ("Minor synonym ('goods' instead of 'items')", "What is the return policy for damaged goods?"),
        ("Rephrased grammar", "What is the policy on returning damaged items?"),
        ("Broader paraphrase", "How do I return a broken product and get my money back?"),
        ("Different topic in same domain", "What are the API rate limits on the Pro tier?"),
        ("Completely unrelated domain", "How do I bake chocolate chip cookies from scratch?"),
    ]

    base_emb = embedder.encode(base_query)

    for label, query in variations:
        var_emb = embedder.encode(query)
        sim = cosine_similarity(base_emb, var_emb)
        print(f"  • [{sim:.4f}] {label}: \"{query}\"")

    # 4. Test SemanticCache Store and Lookup
    print("\n[Step 4] Testing SemanticCache Storage and Live Retrieval...")
    # Using 0.75 threshold (ideal for semantic paraphrase matching with all-MiniLM-L6-v2)
    test_threshold = 0.75
    cache = SemanticCache(org, threshold=test_threshold)
    cache.clear()
    print(f" Cache cleared for test organization. Active threshold: {test_threshold}")

    # Seed query
    seed_a1 = "Defective or damaged items may be returned within 30 days of purchase for a full refund or replacement."
    cache.store(
        query_text=base_query,
        query_embedding=base_emb,
        response_text=seed_a1,
        model="gemini-2.5-flash",
        token_metadata={"input_tokens": 15, "output_tokens": 25},
    )
    print(f" Stored Entry: \"{base_query}\"")

    # Test 4A: Exact query lookup
    print("\n  Test 4A: Exact query lookup")
    res_exact = cache.lookup(base_emb, base_query)
    assert res_exact is not None and res_exact["cache_hit"] is True
    print(f"   -> HIT! Score: {res_exact.get('score'):.4f}, Answer: \"{res_exact['answer'][:50]}...\"")

    # Test 4B: Synonym variation query lookup
    syn_query = "What is the return policy for damaged goods?"
    syn_emb = embedder.encode(syn_query)
    print(f"\n  Test 4B: Synonym variation (\"{syn_query}\")")
    res_syn = cache.lookup(syn_emb, syn_query)
    assert res_syn is not None and res_syn["cache_hit"] is True, f"Expected cache hit on synonym variation (threshold {test_threshold})"
    print(f"   -> HIT! Score: {res_syn['score']:.4f} (>= {test_threshold})")
    print(f"   Served Answer: \"{res_syn['answer']}\"")

    # Test 4C: Rephrased grammar lookup
    rephrased_query = "What is the policy on returning damaged items?"
    rephrased_emb = embedder.encode(rephrased_query)
    print(f"\n  Test 4C: Rephrased query (\"{rephrased_query}\")")
    res_rephrased = cache.lookup(rephrased_emb, rephrased_query)
    assert res_rephrased is not None and res_rephrased["cache_hit"] is True, f"Expected cache hit on rephrased query (threshold {test_threshold})"
    print(f"   -> HIT! Score: {res_rephrased['score']:.4f} (>= {test_threshold})")
    print(f"   Served Answer: \"{res_rephrased['answer']}\"")

    # Test 4D: Completely unrelated query lookup (Cache Miss)
    unrelated_query = "How do I bake chocolate chip cookies from scratch?"
    unrelated_emb = embedder.encode(unrelated_query)
    print(f"\n  Test 4D: Unrelated query (\"{unrelated_query}\")")
    res_unrelated = cache.lookup(unrelated_emb, unrelated_query)
    assert res_unrelated is None, "Expected cache miss on unrelated sentence!"
    print(f"   -> MISS! Score was below threshold {test_threshold}. Live external LLM would be invoked.")

    # Seed query 2 (API query)
    seed_q4 = "What are the API rate limits on the Pro tier?"
    seed_a4 = "The Pro tier includes 60 requests per minute and 1,000 monthly queries."
    emb_q4 = embedder.encode(seed_q4)
    cache.store(
        query_text=seed_q4,
        query_embedding=emb_q4,
        response_text=seed_a4,
        model="gemini-2.5-flash",
    )
    print(f"\n Stored Entry 2: \"{seed_q4}\"")

    # Test rephrased API query
    test_q5 = "What is the API rate limit on the Pro plan?"
    emb_q5 = embedder.encode(test_q5)
    sim_5 = cosine_similarity(emb_q4, emb_q5)
    print(f"\n  Test 4E: Rephrased API query (\"{test_q5}\")")
    print(f"   Cosine similarity with seed: {sim_5:.4f}")
    res_para2 = cache.lookup(emb_q5, test_q5)
    assert res_para2 is not None and res_para2["cache_hit"] is True, f"Expected semantic cache hit (score {sim_5:.4f} >= {test_threshold})!"
    print(f"   -> HIT! Score: {res_para2['score']:.4f}")
    print(f"   Served Answer: \"{res_para2['answer']}\"")

    # 5. Verify Stats
    stats = cache.get_stats()
    print("\n[Step 5] Cache Statistics:")
    print(f" Total Entries: {stats['total_entries']}, Valid Entries: {stats['valid_entries']}")
    assert stats["valid_entries"] == 2

    # Clean up test entries
    cache.clear()
    print("\n Test cache entries cleaned up.")

    print("\n" + "=" * 80)
    print(" ALL SEMANTIC CACHING TESTS PASSED PERFECTLY!")
    print("=" * 80)
    return True


if __name__ == "__main__":
    try:
        success = run_semantic_cache_test()
        sys.exit(0 if success else 1)
    except Exception as exc:
        print(f"\n[ERROR] Test failed with exception: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
