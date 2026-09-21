import os
import sys
import django

# Configure Django to use SQLite test environment
os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
django.setup()

from django.core.management import call_command
call_command("migrate", verbosity=0)

from rest_framework.test import APIClient
from accounts.models import Organization, User, Membership
from billing.models import Plan, APIKey
from ai_service.models import Document, CacheEntry


def run_api_key_permission_tests():
    print("=" * 80)
    print("TESTING API KEY AUTHENTICATION & PERMISSIONS FOR EXTERNAL CLIENTS")
    print("=" * 80)

    client = APIClient()

    # 1. Setup Test Organization and Plan
    print("\n[Step 1] Setting up Test Organization and Owner...")
    pro_plan, _ = Plan.objects.get_or_create(
        name="pro",
        defaults={"requests_per_minute": 60, "monthly_request_limit": 1000, "price": 49.0}
    )
    org, _ = Organization.objects.get_or_create(
        slug="api-key-test-org",
        defaults={"name": "API Key Test Org", "plan": pro_plan, "cache_threshold": 0.85}
    )
    owner, _ = User.objects.get_or_create(
        email="apikey_owner@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    Membership.objects.update_or_create(
        user=owner, organization=org,
        defaults={"role": "owner", "is_active": True}
    )
    print(f" Organization: {org.name} ({org.id})")

    # 2. Create 3 API Keys with distinct permission scopes + 1 revoked key
    print("\n[Step 2] Provisioning API Keys with Read, Write, Admin, and Inactive Scopes...")
    APIKey.objects.filter(organization=org).delete()

    key_read = APIKey(organization=org, name="External Read-Only Key", permissions=APIKey.PERMISSION_READ)
    key_read.save()
    raw_read = key_read._raw_key

    key_write = APIKey(organization=org, name="External Write/Query Key", permissions=APIKey.PERMISSION_WRITE)
    key_write.save()
    raw_write = key_write._raw_key

    key_admin = APIKey(organization=org, name="External Admin Key", permissions=APIKey.PERMISSION_ADMIN)
    key_admin.save()
    raw_admin = key_admin._raw_key

    key_revoked = APIKey(organization=org, name="Revoked Key", permissions=APIKey.PERMISSION_WRITE)
    key_revoked.save()
    raw_revoked = key_revoked._raw_key
    key_revoked.is_active = False
    key_revoked.save(update_fields=["is_active"])

    print(f"  • Read Key:    {raw_read[:16]}... (permissions={key_read.permissions})")
    print(f"  • Write Key:   {raw_write[:16]}... (permissions={key_write.permissions})")
    print(f"  • Admin Key:   {raw_admin[:16]}... (permissions={key_admin.permissions})")
    print(f"  • Revoked Key: {raw_revoked[:16]}... (is_active={key_revoked.is_active})")

    # 3. Test Authentication Validity & Header Formats
    print("\n[Step 3] Testing Authentication Handling & Header Styles:")
    # "Authorization: Bearer <key>", "Authorization: ApiKey <key>", and "X-API-Key: <key>"
    resp_bearer = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_read}")
    resp_apikey = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"ApiKey {raw_read}")
    resp_xapikey = client.get("/api/ai/documents/", HTTP_X_API_KEY=raw_read)
    print(f"  • Authorization: Bearer <key> -> HTTP {resp_bearer.status_code}")
    print(f"  • Authorization: ApiKey <key> -> HTTP {resp_apikey.status_code}")
    print(f"  • X-API-Key: <key>            -> HTTP {resp_xapikey.status_code}")
    assert resp_bearer.status_code == 200, f"Expected 200 OK with Bearer header, got {resp_bearer.status_code}"
    assert resp_apikey.status_code == 200, f"Expected 200 OK with ApiKey header, got {resp_apikey.status_code}"
    assert resp_xapikey.status_code == 200, f"Expected 200 OK with X-API-Key header, got {resp_xapikey.status_code}"

    # Revoked key check
    resp_revoked = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_revoked}")
    print(f"  • Revoked Key Request -> HTTP {resp_revoked.status_code} (Expected 401)")
    assert resp_revoked.status_code == 401, f"Expected 401 for revoked key, got {resp_revoked.status_code}"

    # Invalid/Forged key check
    resp_fake = client.get("/api/ai/documents/", HTTP_AUTHORIZATION="Bearer sk_live_fakekeythatdoesnotexist1234")
    print(f"  • Invalid Key Request -> HTTP {resp_fake.status_code} (Expected 401)")
    assert resp_fake.status_code == 401, f"Expected 401 for fake key, got {resp_fake.status_code}"

    # 4. Test Permissions on Read-Only Endpoints (GET /api/ai/documents/)
    print("\n[Step 4] Testing Read-Only Endpoint (GET /api/ai/documents/):")
    st_r = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_read}").status_code
    st_w = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_write}").status_code
    st_a = client.get("/api/ai/documents/", HTTP_AUTHORIZATION=f"Bearer {raw_admin}").status_code
    print(f"  • Read Key:  HTTP {st_r} (Expected 200)")
    print(f"  • Write Key: HTTP {st_w} (Expected 200)")
    print(f"  • Admin Key: HTTP {st_a} (Expected 200)")
    assert st_r == 200 and st_w == 200 and st_a == 200, "All keys should be able to view documents!"

    # 5. Test Permissions on Write Endpoints (POST /api/ai/documents/)
    print("\n[Step 5] Testing Document Upload Endpoint (POST /api/ai/documents/):")
    # Read key MUST be forbidden (403)
    resp_doc_r = client.post("/api/ai/documents/", {"filename": "doc_read.txt", "title": "Doc Read"}, HTTP_AUTHORIZATION=f"Bearer {raw_read}")
    print(f"  • Read Key upload:  HTTP {resp_doc_r.status_code} (Expected 403 Forbidden)")
    assert resp_doc_r.status_code == 403, f"Read key must be forbidden from writing documents, got {resp_doc_r.status_code}"

    # Write key MUST be allowed (201)
    resp_doc_w = client.post("/api/ai/documents/", {"filename": "doc_write.txt", "title": "Doc Write"}, HTTP_AUTHORIZATION=f"Bearer {raw_write}")
    print(f"  • Write Key upload: HTTP {resp_doc_w.status_code} (Expected 201 Created)")
    assert resp_doc_w.status_code == 201, f"Write key should be allowed to upload documents, got {resp_doc_w.status_code}"
    doc_id = resp_doc_w.data.get("id")

    # Admin key MUST be allowed (201)
    resp_doc_a = client.post("/api/ai/documents/", {"filename": "doc_admin.txt", "title": "Doc Admin"}, HTTP_AUTHORIZATION=f"Bearer {raw_admin}")
    print(f"  • Admin Key upload: HTTP {resp_doc_a.status_code} (Expected 201 Created)")
    assert resp_doc_a.status_code == 201, f"Admin key should be allowed to upload documents, got {resp_doc_a.status_code}"

    # 6. Test Permissions on AI Query Execution (POST /api/ai/query/)
    print("\n[Step 6] Testing AI Query Endpoint (POST /api/ai/query/):")
    # Read key MUST be forbidden (403)
    resp_q_r = client.post("/api/ai/query/", {"question": "Can I query?"}, HTTP_AUTHORIZATION=f"Bearer {raw_read}")
    print(f"  • Read Key query:  HTTP {resp_q_r.status_code} (Expected 403 Forbidden)")
    assert resp_q_r.status_code == 403, f"Read key must not be allowed to execute AI queries, got {resp_q_r.status_code}"

    # Write key should pass permission check (CanUseAI)
    # Note: Even if external LLM client is simulated or fails, permission is evaluated first (403 vs 200/500/503)
    resp_q_w = client.post("/api/ai/query/", {"question": "Hello from external code"}, HTTP_AUTHORIZATION=f"Bearer {raw_write}")
    print(f"  • Write Key query permission check: HTTP {resp_q_w.status_code} (Expected NOT 403)")
    assert resp_q_w.status_code != 403, f"Write key was unexpectedly denied with 403!"

    # 7. Test Permissions on Admin Endpoints (PATCH /api/cache/threshold/ & DELETE /api/cache/clear/)
    print("\n[Step 7] Testing Admin-Only Cache Administration Endpoints:")
    # Read key -> 403
    st_thresh_r = client.patch("/api/cache/threshold/", {"threshold": 0.90}, HTTP_AUTHORIZATION=f"Bearer {raw_read}").status_code
    st_clear_r = client.delete("/api/cache/clear/", HTTP_AUTHORIZATION=f"Bearer {raw_read}").status_code
    print(f"  • Read Key:  PATCH threshold -> HTTP {st_thresh_r} (403), DELETE clear -> HTTP {st_clear_r} (403)")
    assert st_thresh_r == 403 and st_clear_r == 403, "Read key must be forbidden from admin actions!"

    # Write key -> 403
    st_thresh_w = client.patch("/api/cache/threshold/", {"threshold": 0.90}, HTTP_AUTHORIZATION=f"Bearer {raw_write}").status_code
    st_clear_w = client.delete("/api/cache/clear/", HTTP_AUTHORIZATION=f"Bearer {raw_write}").status_code
    print(f"  • Write Key: PATCH threshold -> HTTP {st_thresh_w} (403), DELETE clear -> HTTP {st_clear_w} (403)")
    assert st_thresh_w == 403 and st_clear_w == 403, "Write key must be forbidden from admin actions!"

    # Admin key -> 200 / 204
    resp_thresh_a = client.patch("/api/cache/threshold/", {"threshold": 0.88}, HTTP_AUTHORIZATION=f"Bearer {raw_admin}")
    resp_clear_a = client.delete("/api/cache/clear/", HTTP_AUTHORIZATION=f"Bearer {raw_admin}")
    print(f"  • Admin Key: PATCH threshold -> HTTP {resp_thresh_a.status_code} (200), DELETE clear -> HTTP {resp_clear_a.status_code} (204)")
    assert resp_thresh_a.status_code == 200, f"Admin key failed to update threshold: {resp_thresh_a.status_code}"
    assert resp_clear_a.status_code == 204, f"Admin key failed to clear cache: {resp_clear_a.status_code}"

    # 8. Verify last_used_at telemetry
    print("\n[Step 8] Verifying last_used_at Telemetry Update:")
    key_admin.refresh_from_db()
    print(f"  • Admin Key last_used_at: {key_admin.last_used_at}")
    assert key_admin.last_used_at is not None, "APIKey last_used_at was not updated after request!"

    # 9. Test Cross-Tenant Isolation
    print("\n[Step 9] Verifying Cross-Tenant Isolation for External Keys:")
    org_other, _ = Organization.objects.get_or_create(
        slug="other-tenant-org",
        defaults={"name": "Other Tenant Org", "plan": pro_plan}
    )
    doc_other = Document.objects.create(organization=org_other, filename="secret_other.txt")

    # Attempt to retrieve other tenant's document using Org A's admin key
    resp_cross = client.get(f"/api/ai/documents/{doc_other.id}/", HTTP_AUTHORIZATION=f"Bearer {raw_admin}")
    print(f"  • Org A Admin Key requesting Org B document: HTTP {resp_cross.status_code} (Expected 404 Not Found)")
    assert resp_cross.status_code == 404, f"Cross-tenant document access must return 404, got {resp_cross.status_code}"

    print("\n" + "=" * 80)
    print(" ALL API KEY AUTHENTICATION & PERMISSIONS TESTS PASSED!")
    print("=" * 80)
    return True


if __name__ == "__main__":
    try:
        success = run_api_key_permission_tests()
        sys.exit(0 if success else 1)
    except Exception as exc:
        print(f"\n[ERROR] API key test failed: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
