import os
import sys
import json
import uuid
import urllib.request
import urllib.error
import django

# Setup Django environment for direct DB verification
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from accounts.models import User, Organization, Membership
from billing.models import Plan, APIKey, Invoice, UsageLog, UsageAggregate
from ai_service.models import AIQuery

BASE_URL = "http://127.0.0.1:8000"


def make_request(method, path, data=None, token=None, api_key=None, raw_body=None, headers_override=None):
    url = f"{BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
    }
    if data is not None or raw_body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    if headers_override:
        headers.update(headers_override)

    body = None
    if raw_body is not None:
        body = raw_body
    elif data is not None:
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.status
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            content = resp.read().decode("utf-8", errors="replace")
            try:
                resp_json = json.loads(content) if content else {}
            except Exception:
                resp_json = {"raw": content}
            return status_code, resp_headers, resp_json
    except urllib.error.HTTPError as e:
        status_code = e.code
        resp_headers = {k.lower(): v for k, v in e.headers.items()}
        content = e.read().decode("utf-8", errors="replace")
        try:
            resp_json = json.loads(content) if content else {}
        except Exception:
            resp_json = {"raw": content}
        return status_code, resp_headers, resp_json
    except Exception as exc:
        return 0, {}, {"error": str(exc)}


def run_tests():
    print("=" * 80)
    print("STARTING COMPLETE E2E VERIFICATION SUITE FOR BILLING, KEYS, AUTH & ADMIN")
    print("=" * 80)

    results = []

    def record(step_num, step_name, passed, detail=""):
        results.append((step_num, step_name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] Step {step_num}: {step_name}")
    def clear_rate_limits():
        try:
            from middleware.redis_utils import get_redis_client
            r = get_redis_client()
            for k in r.keys("ratelimit:*"):
                r.delete(k)
        except Exception:
            pass

    clear_rate_limits()

    # -------------------------------------------------------------
    # 0. Setup Foundation Plans and Superadmin
    # -------------------------------------------------------------
    free_plan, _ = Plan.objects.get_or_create(
        name="free",
        defaults={"requests_per_minute": 10, "monthly_request_limit": 100, "price": 0.00}
    )
    pro_plan, _ = Plan.objects.get_or_create(
        name="pro",
        defaults={"requests_per_minute": 60, "monthly_request_limit": 1000, "price": 49.00}
    )
    enterprise_plan, _ = Plan.objects.get_or_create(
        name="enterprise",
        defaults={"requests_per_minute": 300, "monthly_request_limit": 10000, "price": 499.00}
    )

    super_user, _ = User.objects.get_or_create(
        email="superadmin_test@example.com",
        defaults={"is_verified": True, "is_active": True, "is_staff": True, "is_superuser": True}
    )
    super_user.is_staff = True
    super_user.is_superuser = True
    super_user.is_verified = True
    super_user.set_password("SuperPass123!")
    super_user.save()

    st_sup, _, b_sup = make_request("POST", "/api/auth/login/", {"email": "superadmin_test@example.com", "password": "SuperPass123!"})
    super_token = b_sup.get("access")

    # Setup standard test org and users
    test_org, _ = Organization.objects.get_or_create(
        slug="billing-test-org",
        defaults={"name": "Billing Test Org", "plan": free_plan, "is_active": True, "monthly_budget": 500.00}
    )
    test_org.plan = free_plan
    test_org.monthly_budget = 500.00
    test_org.is_active = True
    test_org.save()

    owner_user, _ = User.objects.get_or_create(
        email="billing_owner@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    owner_user.set_password("BillingPass123!")
    owner_user.is_verified = True
    owner_user.save()
    Membership.objects.update_or_create(user=owner_user, organization=test_org, defaults={"role": "owner", "is_active": True})

    member_user, _ = User.objects.get_or_create(
        email="billing_member@example.com",
        defaults={"is_verified": True, "is_active": True}
    )
    member_user.set_password("MemberPass123!")
    member_user.is_verified = True
    member_user.save()
    Membership.objects.update_or_create(user=member_user, organization=test_org, defaults={"role": "member", "is_active": True})

    st_login_owner, _, b_owner = make_request("POST", "/api/auth/login/", {"email": "billing_owner@example.com", "password": "BillingPass123!"})
    owner_token = b_owner.get("access")
    owner_refresh = b_owner.get("refresh")

    st_login_member, _, b_member = make_request("POST", "/api/auth/login/", {"email": "billing_member@example.com", "password": "MemberPass123!"})
    member_token = b_member.get("access")

    record(0, "Setup Environment & Authenticate Roles", st_login_owner == 200 and st_login_member == 200 and st_sup == 200, "Tokens obtained for superadmin, owner, and member")

    # -------------------------------------------------------------
    # SECTION 1: AUTH LIFECYCLE (REGISTER, LOGIN, REFRESH, RESET, VERIFY)
    # -------------------------------------------------------------
    print("\n--- SECTION 1: AUTH LIFECYCLE ---")

    # Step 1: POST /api/auth/register/
    test_reg_email = f"registered_{uuid.uuid4().hex[:6]}@example.com"
    st_reg, _, b_reg = make_request("POST", "/api/auth/register/", {
        "email": test_reg_email,
        "password": "RegisterPass123!",
        "organization_name": "Registered Corp"
    })
    step1_pass = st_reg == 201 and "access" in b_reg and "refresh" in b_reg
    record(1, "Register New User and Org (POST /api/auth/register/)", step1_pass, f"HTTP {st_reg}, User: {b_reg.get('user', {}).get('email')}")

    # Step 2: POST /api/auth/refresh/
    st_ref, _, b_ref = make_request("POST", "/api/auth/refresh/", {"refresh": owner_refresh})
    step2_pass = st_ref == 200 and "access" in b_ref
    record(2, "JWT Refresh Token Rotation (POST /api/auth/refresh/)", step2_pass, f"HTTP {st_ref}, New Access Token: {bool(b_ref.get('access'))}")

    # Step 3: POST /api/auth/password-reset/
    st_pr, _, b_pr = make_request("POST", "/api/auth/password-reset/", {"email": "billing_owner@example.com"})
    reset_tok = b_pr.get("reset_token")
    step3_pass = st_pr == 200 and bool(reset_tok)
    record(3, "Generate Password Reset Token (POST /api/auth/password-reset/)", step3_pass, f"HTTP {st_pr}, Reset Token Present: {bool(reset_tok)}")

    # Step 4: POST /api/auth/password-reset/confirm/
    new_pw = "NewOwnerPass123!"
    st_conf, _, b_conf = make_request("POST", "/api/auth/password-reset/confirm/", {
        "token": reset_tok,
        "password": new_pw
    })
    # Verify login with new password
    st_log_new, _, b_log_new = make_request("POST", "/api/auth/login/", {"email": "billing_owner@example.com", "password": new_pw})
    step4_pass = st_conf == 200 and st_log_new == 200
    if step4_pass:
        owner_token = b_log_new.get("access")  # update owner_token
    record(4, "Confirm Password Reset & Login (POST /api/auth/password-reset/confirm/)", step4_pass, f"Confirm HTTP {st_conf}, New Login HTTP {st_log_new}")

    # Step 5: GET /api/auth/verify/{token}/
    from django.core.signing import TimestampSigner
    signer = TimestampSigner()
    verify_token = signer.sign(str(owner_user.id))
    st_ver, _, b_ver = make_request("GET", f"/api/auth/verify/{verify_token}/")
    step5_pass = st_ver == 200 and b_ver.get("detail") == "Email verified successfully."
    record(5, "Email Verification (GET /api/auth/verify/{token}/)", step5_pass, f"HTTP {st_ver}, Detail: {b_ver.get('detail')}")

    # -------------------------------------------------------------
    # SECTION 2: API KEYS LIFECYCLE (/api/keys/)
    # -------------------------------------------------------------
    print("\n--- SECTION 2: API KEYS LIFECYCLE ---")

    # Step 6: List API keys initially
    st_keys_list, _, b_keys_list = make_request("GET", "/api/keys/", token=owner_token)
    keys_list = b_keys_list.get("results", b_keys_list if isinstance(b_keys_list, list) else [])
    step6_pass = st_keys_list == 200
    record(6, "List API Keys (GET /api/keys/)", step6_pass, f"HTTP {st_keys_list}, Initial Count: {len(keys_list)}")

    # Step 7: Create API key (POST /api/keys/)
    st_key_create, _, b_key_create = make_request("POST", "/api/keys/", {
        "name": "Production Key",
        "permissions": "write",
        "rate_limit_override": 120
    }, token=owner_token)
    raw_api_key = b_key_create.get("full_key") or b_key_create.get("raw_key")
    key_id = b_key_create.get("id")
    prefix = b_key_create.get("key_prefix")
    step7_pass = st_key_create == 201 and bool(raw_api_key) and bool(key_id) and bool(prefix)
    record(7, "Create API Key with Full Key Revelation (POST /api/keys/)", step7_pass, f"HTTP {st_key_create}, ID: {key_id}, Prefix: {prefix}, Full Key Revealed: {bool(raw_api_key)}")

    # Step 8: Retrieve API key details (GET /api/keys/{id}/) - Verify full key is NOT returned on subsequent reads
    st_key_get, _, b_key_get = make_request("GET", f"/api/keys/{key_id}/", token=owner_token)
    full_not_exposed = not b_key_get.get("full_key") and not b_key_get.get("raw_key")
    step8_pass = st_key_get == 200 and full_not_exposed and b_key_get.get("key_prefix") == prefix
    record(8, "Retrieve Key Details Without Full Key (GET /api/keys/{id}/)", step8_pass, f"HTTP {st_key_get}, Prefix: {b_key_get.get('key_prefix')}, Full Key Concealed: {full_not_exposed}")

    # Step 9: Authenticate using newly created API Key
    st_auth_key, _, b_auth_key = make_request("GET", "/api/billing/usage/", api_key=raw_api_key)
    step9_pass = st_auth_key == 200
    record(9, "Authenticate via Bearer API Key Header", step9_pass, f"HTTP {st_auth_key}, Usage Auth Passed: {step9_pass}")

    # Step 10: PATCH /api/keys/{id}/ (rename, permission changes, rate-limit override)
    st_patch_key, _, b_patch_key = make_request("PATCH", f"/api/keys/{key_id}/", {
        "name": "Production Key Renamed",
        "permissions": "admin",
        "rate_limit_override": 200
    }, token=owner_token)
    step10_pass = (
        st_patch_key == 200 and
        b_patch_key.get("name") == "Production Key Renamed" and
        b_patch_key.get("permissions") == "admin" and
        b_patch_key.get("rate_limit_override") == 200
    )
    record(10, "PATCH API Key - Rename, Perms & Limit (PATCH /api/keys/{id}/)", step10_pass, f"HTTP {st_patch_key}, New Name: {b_patch_key.get('name')}, Perms: {b_patch_key.get('permissions')}, Override: {b_patch_key.get('rate_limit_override')}")

    # Step 11: POST /api/keys/{id}/regenerate/
    st_regen, _, b_regen = make_request("POST", f"/api/keys/{key_id}/regenerate/", token=owner_token)
    regen_full_key = b_regen.get("full_key") or b_regen.get("raw_key")
    regen_key_id = b_regen.get("id")
    step11_pass = st_regen == 200 and bool(regen_full_key) and regen_key_id != key_id
    record(11, "Regenerate API Key (POST /api/keys/{id}/regenerate/)", step11_pass, f"HTTP {st_regen}, New ID: {regen_key_id}, New Full Key Revealed: {bool(regen_full_key)}")

    # Step 12: Verify Old Key Revoked and New Regenerated Key Functional
    st_old_test, _, _ = make_request("GET", "/api/billing/usage/", api_key=raw_api_key)
    st_new_test, _, _ = make_request("GET", "/api/billing/usage/", api_key=regen_full_key)
    step12_pass = st_old_test == 401 and st_new_test == 200
    record(12, "Verify Revocation of Old Key & Validity of Regenerated Key", step12_pass, f"Old Key HTTP: {st_old_test} (Expected 401), New Key HTTP: {st_new_test} (Expected 200)")

    # Step 13: DELETE /api/keys/{id}/
    st_del_key, _, _ = make_request("DELETE", f"/api/keys/{regen_key_id}/", token=owner_token)
    st_del_verify, _, _ = make_request("GET", f"/api/keys/{regen_key_id}/", token=owner_token)
    step13_pass = st_del_key in [200, 204] and st_del_verify == 404
    record(13, "Delete/Revoke Key (DELETE /api/keys/{id}/)", step13_pass, f"Delete HTTP {st_del_key}, Verify HTTP {st_del_verify}")

    # Step 14: API Key RBAC - Member Forbidden from Creating API Keys
    st_mem_create, _, _ = make_request("POST", "/api/keys/", {"name": "Member Key"}, token=member_token)
    step14_pass = st_mem_create == 403
    record(14, "RBAC - Member Forbidden from Managing API Keys (403)", step14_pass, f"HTTP {st_mem_create}")

    # Step 15: Read-Only API Key Enforced (Cannot Execute AI Queries)
    st_ro_key, _, b_ro_key = make_request("POST", "/api/keys/", {
        "name": "Read Only Key",
        "permissions": "read"
    }, token=owner_token)
    ro_raw = b_ro_key.get("full_key")
    st_ro_query, _, b_ro_query = make_request("POST", "/api/ai/query/", {"question": "Hello?"}, api_key=ro_raw)
    step15_pass = st_ro_key == 201 and st_ro_query == 403
    record(15, "API Key Permission Enforcement - Read-Only Key Blocked from AI Query (403)", step15_pass, f"Create RO Key HTTP: {st_ro_key}, AI Query HTTP: {st_ro_query}")

    # -------------------------------------------------------------
    # SECTION 3: BILLING ENDPOINTS (/api/billing/)
    # -------------------------------------------------------------
    print("\n--- SECTION 3: BILLING ENDPOINTS ---")
    clear_rate_limits()

    # Step 16: GET /api/billing/plan/
    st_plan, _, b_plan = make_request("GET", "/api/billing/plan/", token=owner_token)
    step16_pass = st_plan == 200 and b_plan.get("name") == "free"
    record(16, "Get Current Plan (GET /api/billing/plan/)", step16_pass, f"HTTP {st_plan}, Plan: {b_plan.get('name')}, Limit: {b_plan.get('monthly_request_limit')}")

    # Step 17: POST /api/billing/upgrade/
    st_upg, _, b_upg = make_request("POST", "/api/billing/upgrade/", {"plan": "pro"}, token=owner_token)
    test_org.refresh_from_db()
    step17_pass = st_upg == 200 and b_upg.get("name") == "pro" and test_org.plan.name == "pro"
    record(17, "Upgrade Plan (POST /api/billing/upgrade/)", step17_pass, f"HTTP {st_upg}, New Plan: {b_upg.get('name')}, DB Plan: {test_org.plan.name}")

    # Step 18: RBAC - Member Forbidden from Upgrading Plan
    st_mem_upg, _, _ = make_request("POST", "/api/billing/upgrade/", {"plan": "enterprise"}, token=member_token)
    step18_pass = st_mem_upg == 403
    record(18, "RBAC - Member Forbidden from Upgrading Plan (403)", step18_pass, f"HTTP {st_mem_upg}")

    # Step 19: GET /api/billing/usage/
    st_usage, _, b_usage = make_request("GET", "/api/billing/usage/", token=owner_token)
    has_usage_fields = all(k in b_usage for k in [
        "plan", "requests_used", "monthly_limit", "remaining", "usage_percent",
        "input_tokens", "output_tokens", "total_cost", "budget_remaining", "projected_monthly_spend"
    ])
    step19_pass = st_usage == 200 and has_usage_fields
    record(19, "Retrieve Detailed Usage & Projected Spend (GET /api/billing/usage/)", step19_pass, f"HTTP {st_usage}, Monthly Limit: {b_usage.get('monthly_limit')}, Used: {b_usage.get('requests_used')}, Budget Rem: {b_usage.get('budget_remaining')}")

    # Step 20: GET /api/billing/usage/export/ (CSV & JSON)
    st_exp_csv, hdrs_csv, b_exp_csv = make_request("GET", "/api/billing/usage/export/", token=owner_token)
    is_csv_content = "text/csv" in hdrs_csv.get("content-type", "") or "attachment; filename=usage_export.csv" in hdrs_csv.get("content-disposition", "")
    st_exp_json, _, b_exp_json = make_request("GET", "/api/billing/usage/export/?format=json", token=owner_token)
    step20_pass = st_exp_csv == 200 and is_csv_content and st_exp_json == 200 and isinstance(b_exp_json, list)
    record(20, "Export Billing Usage (GET /api/billing/usage/export/)", step20_pass, f"CSV HTTP: {st_exp_csv}, Content-Type: {hdrs_csv.get('content-type')}, JSON HTTP: {st_exp_json}")

    # Step 21: GET /api/billing/invoices/
    Invoice.objects.get_or_create(
        organization=test_org,
        defaults={
            "period_start": timezone.now().date(),
            "period_end": timezone.now().date(),
            "amount": 49.00,
            "status": "paid"
        }
    )
    st_inv, _, b_inv = make_request("GET", "/api/billing/invoices/", token=owner_token)
    inv_list = b_inv.get("results", b_inv if isinstance(b_inv, list) else [])
    step21_pass = st_inv == 200 and len(inv_list) >= 1
    record(21, "List Organization Invoices (GET /api/billing/invoices/)", step21_pass, f"HTTP {st_inv}, Invoices Count: {len(inv_list)}, First Amount: {inv_list[0].get('amount') if inv_list else None}")

    # -------------------------------------------------------------
    # SECTION 4: HEALTH & ADMIN ENDPOINTS
    # -------------------------------------------------------------
    print("\n--- SECTION 4: HEALTH & ADMIN ENDPOINTS ---")

    # Step 22: GET /api/health/ (Public Health Check)
    st_pub_hlth, _, b_pub_hlth = make_request("GET", "/api/health/")
    step22_pass = st_pub_hlth == 200 and b_pub_hlth.get("status") in ["ok", "healthy"] and b_pub_hlth.get("database") == "healthy"
    record(22, "Public Health Check (GET /api/health/)", step22_pass, f"HTTP {st_pub_hlth}, Status: {b_pub_hlth.get('status')}, DB: {b_pub_hlth.get('database')}")

    # Step 23: GET /api/admin/health/ (Superadmin Health Check)
    st_adm_hlth, _, b_adm_hlth = make_request("GET", "/api/admin/health/", token=super_token)
    st_adm_non_sup, _, _ = make_request("GET", "/api/admin/health/", token=owner_token)
    step23_pass = st_adm_hlth == 200 and "database" in b_adm_hlth and "redis" in b_adm_hlth and st_adm_non_sup == 403
    record(23, "Superadmin Deep Health (GET /api/admin/health/)", step23_pass, f"Superadmin HTTP: {st_adm_hlth}, DB Status: {b_adm_hlth.get('database', {}).get('status')}, Non-Superadmin HTTP: {st_adm_non_sup} (403)")

    # Step 24: GET /api/admin/usage/ (Superadmin System Metrics)
    st_adm_usg, _, b_adm_usg = make_request("GET", "/api/admin/usage/", token=super_token)
    st_adm_usg_block, _, _ = make_request("GET", "/api/admin/usage/", token=owner_token)
    has_admin_usage = all(k in b_adm_usg for k in ["total_organizations", "total_users", "monthly_cost_estimate", "revenue_estimate"])
    step24_pass = st_adm_usg == 200 and has_admin_usage and st_adm_usg_block == 403
    record(24, "Superadmin Aggregate Usage Metrics (GET /api/admin/usage/)", step24_pass, f"Superadmin HTTP: {st_adm_usg}, Total Orgs: {b_adm_usg.get('total_organizations')}, Revenue Est: {b_adm_usg.get('revenue_estimate')}, Non-Superadmin HTTP: {st_adm_usg_block}")

    # Step 25: GET /api/admin/tenants/ (Superadmin Tenant Overview)
    st_adm_tenants, _, b_adm_tenants = make_request("GET", "/api/admin/tenants/", token=super_token)
    st_adm_ten_block, _, _ = make_request("GET", "/api/admin/tenants/", token=owner_token)
    tenants_list = b_adm_tenants.get("tenants", [])
    step25_pass = st_adm_tenants == 200 and len(tenants_list) >= 1 and st_adm_ten_block == 403
    record(25, "Superadmin Tenant Fleet List (GET /api/admin/tenants/)", step25_pass, f"Superadmin HTTP: {st_adm_tenants}, Fleet Size: {len(tenants_list)}, Non-Superadmin HTTP: {st_adm_ten_block}")

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
