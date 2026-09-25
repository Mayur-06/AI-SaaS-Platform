import os, sys
from pathlib import Path
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
import os
import sys
import json
import urllib.request
import urllib.error
import django

# Setup Django environment for direct DB verification
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from accounts.models import User, Organization, Membership
from billing.models import Plan, UsageLog, UsageAggregate, ModelConfig, RoutingRule
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry

BASE_URL = "http://127.0.0.1:8000"


def make_request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.status
            resp_headers = dict(resp.headers)
            content = resp.read().decode("utf-8")
            try:
                resp_json = json.loads(content) if content else {}
            except Exception:
                resp_json = {"raw": content}
            return status_code, resp_headers, resp_json
    except urllib.error.HTTPError as e:
        status_code = e.code
        resp_headers = dict(e.headers)
        content = e.read().decode("utf-8")
        try:
            resp_json = json.loads(content) if content else {}
        except Exception:
            resp_json = {"raw": content}
        return status_code, resp_headers, resp_json


def run_tests():
    print("=" * 80)
    print("STARTING COMPLETE E2E VERIFICATION SUITE FOR AI SERVICE ENDPOINTS")
    print("=" * 80)

    results = []

    def record(step_num, step_name, passed, detail=""):
        results.append((step_num, step_name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] Step {step_num}: {step_name}")
        print(f"       Details: {detail}")

    # 1. Setup Test Organization & Users
    print("\n--- Setup Test Organization & Users ---")
    pro_plan, _ = Plan.objects.get_or_create(
        name="pro",
        defaults={"requests_per_minute": 60, "monthly_request_limit": 1000, "price": 49.00}
    )
    pro_plan.requests_per_minute = 60
    pro_plan.save()

    org, _ = Organization.objects.get_or_create(
        slug="ai-test-org",
        defaults={
            "name": "AI Test Org",
            "plan": pro_plan,
            "is_active": True,
            "cache_threshold": 0.95,
        }
    )
    org.is_active = True
    org.plan = pro_plan
    org.cache_threshold = 0.95
    org.save()

    # Ensure gemini-2.5-flash is active ModelConfig
    gemini_cfg, _ = ModelConfig.objects.get_or_create(
        name="gemini-2.5-flash",
        defaults={"provider": "gemini", "is_active": True, "input_cost_per_1k": 0.0001, "output_cost_per_1k": 0.0004}
    )
    if gemini_cfg.name != "gemini-2.5-flash" or not gemini_cfg.is_active:
        gemini_cfg.name = "gemini-2.5-flash"
        gemini_cfg.is_active = True
        gemini_cfg.save()

    rule, _ = RoutingRule.objects.get_or_create(
        plan=pro_plan,
        defaults={"primary_model": gemini_cfg, "timeout_seconds": 15}
    )
    if rule.primary_model != gemini_cfg:
        rule.primary_model = gemini_cfg
        rule.save()

    # Clear redis rate limit keys for this org
    try:
        from middleware.redis_utils import get_redis_client
        r = get_redis_client()
        for k in r.keys(f"ratelimit:{org.id}:*"):
            r.delete(k)
    except Exception as exc:
        print("Note: redis flush warning:", exc)

    # Setup Owner
    owner_user, _ = User.objects.get_or_create(
        email="ai_owner@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    owner_user.set_password("AIPass123!")
    owner_user.is_verified = True
    owner_user.is_active = True
    owner_user.save()

    Membership.objects.update_or_create(
        user=owner_user, organization=org,
        defaults={"role": "owner", "is_active": True}
    )

    # Setup Member
    member_user, _ = User.objects.get_or_create(
        email="ai_member@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    member_user.set_password("AIPass123!")
    member_user.is_verified = True
    member_user.is_active = True
    member_user.save()

    Membership.objects.update_or_create(
        user=member_user, organization=org,
        defaults={"role": "member", "is_active": True}
    )

    # Setup Viewer
    viewer_user, _ = User.objects.get_or_create(
        email="ai_viewer@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    viewer_user.set_password("AIPass123!")
    viewer_user.is_verified = True
    viewer_user.is_active = True
    viewer_user.save()

    Membership.objects.update_or_create(
        user=viewer_user, organization=org,
        defaults={"role": "viewer", "is_active": True}
    )

    # Clean prior documents/queries/cache for this org
    Document.objects.filter(organization=org).delete()
    AIQuery.objects.filter(organization=org).delete()
    CacheEntry.objects.filter(organization=org).delete()
    UsageLog.objects.filter(organization=org).delete()

    # Authenticate all 3 roles
    st_o, _, body_o = make_request("POST", "/api/auth/login/", {"email": "ai_owner@example.com", "password": "AIPass123!"})
    owner_token = body_o.get("access")

    st_m, _, body_m = make_request("POST", "/api/auth/login/", {"email": "ai_member@example.com", "password": "AIPass123!"})
    member_token = body_m.get("access")

    st_v, _, body_v = make_request("POST", "/api/auth/login/", {"email": "ai_viewer@example.com", "password": "AIPass123!"})
    viewer_token = body_v.get("access")

    auth_ok = st_o == 200 and st_m == 200 and st_v == 200 and owner_token and member_token and viewer_token
    record(0, "Authenticate Owner, Member, and Viewer", auth_ok, f"Owner: {bool(owner_token)}, Member: {bool(member_token)}, Viewer: {bool(viewer_token)}")

    # Step 1: List Documents
    print("\n--- Step 1: GET /api/ai/documents/ ---")
    st, hdrs, body = make_request("GET", "/api/ai/documents/", token=owner_token)
    req_id = hdrs.get("x-request-id") or hdrs.get("X-Request-ID")
    rate_lim = hdrs.get("x-ratelimit-limit") or hdrs.get("X-RateLimit-Limit")
    docs_list = body.get("results", body if isinstance(body, list) else [])
    step1_pass = st == 200 and isinstance(docs_list, list) and len(docs_list) == 0 and req_id is not None
    record(1, "List Documents (GET /api/ai/documents/)", step1_pass, f"HTTP {st}, Count: {len(docs_list)}, X-Request-ID: {req_id}, Limit: {rate_lim}")

    # Step 2: Create Document
    print("\n--- Step 2: POST /api/ai/documents/ ---")
    st, hdrs, body = make_request("POST", "/api/ai/documents/", {"filename": "ai_platform_guide.txt"}, token=owner_token)
    doc_id = body.get("id")
    doc_status = body.get("status")
    step2_pass = st == 201 and doc_id is not None and doc_status == "pending"
    record(2, "Create Document (POST /api/ai/documents/)", step2_pass, f"HTTP {st}, Doc ID: {doc_id}, Status: {doc_status}")

    # Step 3: Retrieve Document
    print(f"\n--- Step 3: GET /api/ai/documents/{doc_id}/ ---")
    st, hdrs, body = make_request("GET", f"/api/ai/documents/{doc_id}/", token=owner_token)
    step3_pass = st == 200 and body.get("id") == doc_id and body.get("filename") == "ai_platform_guide.txt"
    record(3, "Retrieve Document Details (GET /api/ai/documents/{id}/)", step3_pass, f"HTTP {st}, File: {body.get('filename')}")

    # Step 4: Process Document (Extract Chunks & Embeddings)
    print(f"\n--- Step 4: POST /api/ai/documents/{doc_id}/process/ ---")
    sample_content = (
        "Antigravity AI SaaS is an enterprise platform with multi-tenant architecture. "
        "It features automated semantic caching, model routing across Gemini and OpenAI, "
        "and granular organization-level quotas and rate limiting."
    )
    st, hdrs, body = make_request("POST", f"/api/ai/documents/{doc_id}/process/", {"content": sample_content}, token=owner_token)
    chunks_count = body.get("chunks_count", 0)
    step4_pass = st == 200 and chunks_count >= 1
    record(4, "Process Document into Chunks (POST /api/ai/documents/{id}/process/)", step4_pass, f"HTTP {st}, Chunks: {chunks_count}, Msg: {body.get('detail')}")

    # Step 5: Verify Document & Chunks in Database
    print("\n--- Step 5: DB Verification of Document & Chunks ---")
    doc_db = Document.objects.filter(id=doc_id).first()
    chunks_db = list(DocumentChunk.objects.filter(document_id=doc_id))
    has_embeddings = len(chunks_db) > 0 and all(len(c.embedding_vector) == 384 for c in chunks_db if c.embedding_vector)
    step5_pass = doc_db is not None and doc_db.status == "ready" and len(chunks_db) >= 1 and has_embeddings
    record(5, "Database Verification of Document & Vector Chunks", step5_pass, f"Doc Status: {doc_db.status if doc_db else None}, Chunks: {len(chunks_db)}, 384-dim Vectors: {has_embeddings}")

    # Step 6: Reprocess Document
    print(f"\n--- Step 6: POST /api/ai/documents/{doc_id}/reprocess/ ---")
    updated_content = (
        "Antigravity AI SaaS Platform version 2.0 features full pgvector vector indexing, "
        "multi-provider fallback routing, and atomic token accounting."
    )
    st, hdrs, body = make_request("POST", f"/api/ai/documents/{doc_id}/reprocess/", {"content": updated_content}, token=owner_token)
    step6_pass = st == 200 and body.get("chunks_count", 0) >= 1
    record(6, "Reprocess Document (POST /api/ai/documents/{id}/reprocess/)", step6_pass, f"HTTP {st}, New Chunks: {body.get('chunks_count')}")

    # Step 7: Temporary Document Creation and Deletion
    print("\n--- Step 7: Document Deletion Lifecycle ---")
    st_t, _, body_t = make_request("POST", "/api/ai/documents/", {"filename": "temp_to_delete.txt"}, token=owner_token)
    temp_id = body_t.get("id")
    st_del, _, _ = make_request("DELETE", f"/api/ai/documents/{temp_id}/", token=owner_token)
    temp_exists = Document.objects.filter(id=temp_id).exists()
    step7_pass = st_del == 204 and not temp_exists
    record(7, "Delete Document (DELETE /api/ai/documents/{id}/)", step7_pass, f"Delete HTTP: {st_del}, Exists in DB: {temp_exists}")

    # Step 8: Fresh AI Query (Cache Miss)
    print("\n--- Step 8: POST /api/ai/query/ (Cache Miss) ---")
    st, hdrs, body = make_request("POST", "/api/ai/query/", {"question": "What is Antigravity AI?"}, token=owner_token)
    ans = body.get("answer", "")
    cache_hit = body.get("cache_hit")
    model_used = body.get("model")
    in_tokens = body.get("input_tokens", 0)
    out_tokens = body.get("output_tokens", 0)
    step8_pass = st == 200 and len(ans) > 0 and cache_hit is False and "gemini" in model_used.lower()
    record(8, "Execute AI Query - Fresh (POST /api/ai/query/)", step8_pass, f"HTTP {st}, CacheHit: {cache_hit}, Model: {model_used}, InTokens: {in_tokens}, OutTokens: {out_tokens}, AnsLen: {len(ans)}")

    # Step 9: Verify Query Persistence & Usage Logging
    print("\n--- Step 9: Database Verification of Query & Usage ---")
    query_db = AIQuery.objects.filter(organization=org).order_by("-created_at").first()
    usage_db = UsageLog.objects.filter(organization=org, endpoint="/api/ai/query/").order_by("-timestamp").first()
    cache_entry_db = CacheEntry.objects.filter(organization=org).first()
    step9_pass = (
        query_db is not None and
        usage_db is not None and
        cache_entry_db is not None and
        query_db.cache_hit is False
    )
    record(9, "Database Persistence for Query, UsageLog, and CacheEntry", step9_pass, f"AIQuery ID: {query_db.id if query_db else None}, UsageLog ID: {usage_db.id if usage_db else None}, CacheEntry Key: {cache_entry_db.cache_key if cache_entry_db else None}")

    # Step 10: Repeat Query (Semantic Cache Hit)
    print("\n--- Step 10: POST /api/ai/query/ (Cache Hit) ---")
    st, hdrs, body = make_request("POST", "/api/ai/query/", {"question": "What is Antigravity AI?"}, token=owner_token)
    ans_cached = body.get("answer", "")
    cache_hit_2 = body.get("cache_hit")
    provider_2 = body.get("provider")
    step10_pass = st == 200 and cache_hit_2 is True and provider_2 == "cache" and ans_cached == ans
    record(10, "Execute AI Query - Semantic Cache Hit (POST /api/ai/query/)", step10_pass, f"HTTP {st}, CacheHit: {cache_hit_2}, Provider: {provider_2}, LatencyMs: {body.get('latency_ms')}, Cost: {body.get('estimated_cost')}")

    # Step 11: AI History List
    print("\n--- Step 11: GET /api/ai/history/ ---")
    st, hdrs, body = make_request("GET", "/api/ai/history/", token=owner_token)
    results_list = body.get("results", [])
    count = body.get("count", 0)
    step11_pass = st == 200 and count >= 1 and len(results_list) >= 1
    record(11, "Query History (GET /api/ai/history/)", step11_pass, f"HTTP {st}, Count: {count}, Top Query: '{results_list[0].get('query_text') if results_list else None}'")

    # Step 12: AI History Sorting
    print("\n--- Step 12: GET /api/ai/history/?sort=cost ---")
    st_c, _, body_c = make_request("GET", "/api/ai/history/?sort=cost", token=owner_token)
    st_m, _, body_m = make_request("GET", "/api/ai/history/?sort=model", token=owner_token)
    step12_pass = st_c == 200 and st_m == 200
    record(12, "Query History Sorting (GET /api/ai/history/?sort=cost/model)", step12_pass, f"Sort by Cost: HTTP {st_c}, Sort by Model: HTTP {st_m}")

    # Step 13: Cache Stats
    print("\n--- Step 13: GET /api/cache/stats/ ---")
    st, hdrs, body = make_request("GET", "/api/cache/stats/", token=owner_token)
    tot = body.get("total_entries")
    val = body.get("valid_entries")
    thresh = body.get("threshold")
    ttl = body.get("ttl_seconds")
    step13_pass = st == 200 and tot >= 1 and val >= 1 and thresh is not None and ttl is not None
    record(13, "Retrieve Cache Stats (GET /api/cache/stats/)", step13_pass, f"HTTP {st}, Total: {tot}, Valid: {val}, Threshold: {thresh}, TTL: {ttl}s")

    # Step 14: Get Similarity Threshold
    print("\n--- Step 14: GET /api/cache/threshold/ ---")
    st, hdrs, body = make_request("GET", "/api/cache/threshold/", token=owner_token)
    step14_pass = st == 200 and abs(body.get("threshold", 0) - 0.95) < 0.01
    record(14, "Get Cache Threshold (GET /api/cache/threshold/)", step14_pass, f"HTTP {st}, Threshold: {body.get('threshold')}")

    # Step 15: Patch Similarity Threshold
    print("\n--- Step 15: PATCH /api/cache/threshold/ ---")
    st, hdrs, body = make_request("PATCH", "/api/cache/threshold/", {"threshold": 0.88}, token=owner_token)
    org.refresh_from_db()
    step15_pass = st == 200 and abs(body.get("threshold", 0) - 0.88) < 0.01 and abs(org.cache_threshold - 0.88) < 0.01
    record(15, "Update Cache Threshold (PATCH /api/cache/threshold/)", step15_pass, f"HTTP {st}, Response: {body.get('threshold')}, DB Value: {org.cache_threshold}")

    # Step 16: Clear Cache
    print("\n--- Step 16: DELETE /api/cache/clear/ ---")
    st, hdrs, body = make_request("DELETE", "/api/cache/clear/", token=owner_token)
    entries_left = CacheEntry.objects.filter(organization=org).count()
    step16_pass = st in (200, 204) and entries_left == 0
    record(16, "Clear Semantic Cache (DELETE /api/cache/clear/)", step16_pass, f"HTTP {st}, DB Cache Entries Left: {entries_left}")

    # Step 17: Cache Stats Post-Clear
    print("\n--- Step 17: GET /api/cache/stats/ post-clear ---")
    st, hdrs, body = make_request("GET", "/api/cache/stats/", token=owner_token)
    step17_pass = st == 200 and body.get("total_entries") == 0 and body.get("valid_entries") == 0
    record(17, "Verify Cache Stats After Clearing (GET /api/cache/stats/)", step17_pass, f"HTTP {st}, Total: {body.get('total_entries')}, Valid: {body.get('valid_entries')}")

    # Step 18: RBAC - Member Can Use AI
    print("\n--- Step 18: RBAC - Member Can Use AI (POST /api/ai/query/) ---")
    st, hdrs, body = make_request("POST", "/api/ai/query/", {"question": "What is the capital of Italy?"}, token=member_token)
    step18_pass = st == 200 and len(body.get("answer", "")) > 0
    record(18, "RBAC - Member Can Execute AI Queries", step18_pass, f"HTTP {st}, Member Model: {body.get('model')}")

    # Step 19: RBAC - Viewer Forbidden from AI Query
    print("\n--- Step 19: RBAC - Viewer Forbidden from AI Query ---")
    st, hdrs, body = make_request("POST", "/api/ai/query/", {"question": "What is the capital of Germany?"}, token=viewer_token)
    step19_pass = st == 403
    record(19, "RBAC - Viewer Forbidden from Executing Queries (403)", step19_pass, f"HTTP {st}, Detail: {body.get('detail')}")

    # Step 20: RBAC - Member Forbidden from Updating Cache Threshold & Clear
    print("\n--- Step 20: RBAC - Member Forbidden from Admin Cache Actions ---")
    st_patch, _, body_patch = make_request("PATCH", "/api/cache/threshold/", {"threshold": 0.50}, token=member_token)
    st_clear, _, body_clear = make_request("DELETE", "/api/cache/clear/", token=member_token)
    step20_pass = st_patch == 403 and st_clear == 403
    record(20, "RBAC - Member Forbidden from Cache Admin (403)", step20_pass, f"Patch HTTP: {st_patch}, Delete HTTP: {st_clear}")

    # Step 21: Monthly Quota Warning & Blocking (Ref: §11.4, §11.6)
    print("\n--- Step 21: Monthly Quota Warning (80%) and Blocking (100%) ---")
    now_month = timezone.now().strftime("%Y-%m")
    agg_quota, _ = UsageAggregate.objects.get_or_create(
        organization=org, month=now_month,
        defaults={"date": timezone.now().date(), "total_requests": 0}
    )
    # Test 80% warning
    monthly_limit = org.plan.monthly_request_limit
    agg_quota.total_requests = int(monthly_limit * 0.8)
    agg_quota.save(update_fields=["total_requests"])

    st_warn, hdrs_warn, _ = make_request("POST", "/api/ai/query/", {"question": "Testing 80% warning"}, token=owner_token)
    usage_warn_hdr = hdrs_warn.get("x-usage-warning") or hdrs_warn.get("X-Usage-Warning")

    # Test 100% blocking (429 MONTHLY_LIMIT_EXCEEDED with upgrade link)
    agg_quota.total_requests = monthly_limit
    agg_quota.save(update_fields=["total_requests"])

    st_block, hdrs_block, body_block = make_request("POST", "/api/ai/query/", {"question": "Testing 100% limit"}, token=owner_token)
    block_code = body_block.get("error", {}).get("code")
    block_warn_hdr = hdrs_block.get("x-usage-warning") or hdrs_block.get("X-Usage-Warning")
    has_upgrade_link = bool(body_block.get("error", {}).get("upgrade_url") or body_block.get("upgrade_url") or body_block.get("error", {}).get("upgrade_link"))

    # Reset quota so further ops don't remain blocked
    agg_quota.total_requests = 10
    agg_quota.save(update_fields=["total_requests"])

    step21_pass = (
        usage_warn_hdr == "approaching_limit" and
        st_block in (429, 402) and
        block_code == "MONTHLY_LIMIT_EXCEEDED" and
        block_warn_hdr == "limit_reached" and
        has_upgrade_link
    )
    record(21, "Monthly Quota Warning & Blocking (Ref: §11.4, §11.6)", step21_pass, f"80% Warning Header: '{usage_warn_hdr}', 100% Status: {st_block}, Code: '{block_code}', Limit Header: '{block_warn_hdr}', Upgrade Link: {has_upgrade_link}")

    # Step 22: Cross-Tenant Data Isolation (Ref: §2.3, §10)
    print("\n--- Step 22: Cross-Tenant Data Isolation ---")
    # Setup Tenant B
    org_b, _ = Organization.objects.get_or_create(
        slug="tenant-b-org",
        defaults={"name": "Tenant B Org", "plan": pro_plan, "is_active": True}
    )
    user_b, _ = User.objects.get_or_create(
        email="tenant_b_user@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    user_b.set_password("TenantBPass123!")
    user_b.is_verified = True
    user_b.save()
    Membership.objects.update_or_create(user=user_b, organization=org_b, defaults={"role": "owner", "is_active": True})

    st_login_b, _, body_b = make_request("POST", "/api/auth/login/", {"email": "tenant_b_user@example.com", "password": "TenantBPass123!"})
    token_b = body_b.get("access")

    # Org B queries documents
    st_docs_b, _, body_docs_b = make_request("GET", "/api/ai/documents/", token=token_b)
    docs_b_list = body_docs_b.get("results", body_docs_b if isinstance(body_docs_b, list) else [])
    has_no_org_a_docs = all(d.get("id") != str(doc_id) for d in docs_b_list)

    # Org B tries to delete Org A's document
    st_del_cross, _, _ = make_request("DELETE", f"/api/ai/documents/{doc_id}/", token=token_b)

    # Org B queries history
    st_hist_b, _, body_hist_b = make_request("GET", "/api/ai/history/", token=token_b)
    hist_b_count = body_hist_b.get("count", 0)

    step22_pass = (
        st_docs_b == 200 and
        has_no_org_a_docs and
        st_del_cross == 404 and
        st_hist_b == 200 and
        hist_b_count == 0
    )
    record(22, "Cross-Tenant Data Isolation (Ref: §2.3, §10)", step22_pass, f"Tenant B Doc Count: {len(docs_b_list)}, Cross-Delete HTTP: {st_del_cross}, Tenant B Hist Count: {hist_b_count}")

    print("\n" + "=" * 80)
    total = len(results)
    passed_cnt = sum(1 for _, _, p, _ in results if p)
    print(f"RESULTS SUMMARY: {passed_cnt} / {total} PASSED")
    print("=" * 80)

    if passed_cnt == total:
        print("ALL TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("SOME TESTS FAILED!")
        return 1


if __name__ == "__main__":
    sys.exit(run_tests())
