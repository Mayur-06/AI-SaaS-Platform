import os
import sys
import json
import urllib.request
import urllib.error
import django

# Setup Django environment for direct DB verification
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import User, Organization, Membership, Invitation
from billing.models import Plan

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
    print("=" * 75)
    print("STARTING E2E SEQUENCE TEST ON GammaOrg FOR /api/org/ ENDPOINTS")
    print("=" * 75)

    results = []

    def record(step_num, step_name, passed, detail=""):
        results.append((step_num, step_name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] Step {step_num}: {step_name}")
        print(f"       Details: {detail}")

    # Reset auxiliary test users and invitations for GammaOrg
    aux_emails = ["gamma_member@example.com", "gamma_viewer@example.com", "gamma_revoke@example.com"]
    User.objects.filter(email__in=aux_emails).delete()
    Invitation.objects.filter(email__in=aux_emails).delete()

    # Ensure GammaOrg is active and has pro plan (60 rpm)
    org_id = "721aa560-d889-4bc2-815a-fdbe4f601c7b"
    org, _ = Organization.objects.get_or_create(id=org_id, defaults={"name": "GammaOrg", "slug": "gammaorg"})
    org.is_active = True
    org.name = "GammaOrg"
    org.monthly_budget = 0
    org.budget_alert_threshold = 80.0
    pro_plan, _ = Plan.objects.get_or_create(name="pro", defaults={"requests_per_minute": 60, "monthly_request_limit": 1000})
    org.plan = pro_plan
    org.save()

    # Ensure gamma_owner is owner of GammaOrg
    owner_user = User.objects.filter(email="gamma_owner@example.com").first()
    if not owner_user:
        owner_user = User.objects.create_user(email="gamma_owner@example.com", password="GammaPass123!", is_verified=True)
    else:
        owner_user.set_password("GammaPass123!")
        owner_user.is_verified = True
        owner_user.save()

    owner_mem = Membership.objects.filter(user=owner_user, organization=org).first()
    if not owner_mem:
        owner_mem = Membership.objects.create(user=owner_user, organization=org, role="owner", is_active=True)
    else:
        owner_mem.role = "owner"
        owner_mem.is_active = True
        owner_mem.save()

    # Step 1: Owner Login
    print("\n--- Step 1: Authenticate Owner ---")
    st, hdrs, body = make_request("POST", "/api/auth/login/", {
        "email": "gamma_owner@example.com",
        "password": "GammaPass123!"
    })
    owner_token = body.get("access")
    step1_pass = st == 200 and owner_token is not None
    record(1, "Owner Login (POST /api/auth/login/)", step1_pass, f"HTTP {st}, Token: {owner_token[:15]}...")

    # Step 2: GET /api/org/
    print("\n--- Step 2: Retrieve Org Settings (GET /api/org/) ---")
    st, hdrs, body = make_request("GET", "/api/org/", token=owner_token)
    req_id = hdrs.get("x-request-id") or hdrs.get("X-Request-ID")
    rl_limit = hdrs.get("x-ratelimit-limit") or hdrs.get("X-RateLimit-Limit")
    rl_rem = hdrs.get("x-ratelimit-remaining") or hdrs.get("X-RateLimit-Remaining")
    rl_reset = hdrs.get("x-ratelimit-reset") or hdrs.get("X-RateLimit-Reset")

    step2_pass = (
        st == 200 and
        body.get("id") == org_id and
        body.get("name") == "GammaOrg" and
        body.get("plan") == "pro" and
        body.get("is_active") is True and
        req_id is not None and
        rl_limit == "60"
    )
    record(2, "Retrieve Org Details (GET /api/org/)", step2_pass, f"HTTP {st}, Org: {body.get('name')}, Plan: {body.get('plan')}, X-Request-ID: {req_id}, Limit: {rl_limit}, Rem: {rl_rem}")

    # Step 3: PUT /api/org/
    print("\n--- Step 3: Update Org (PUT /api/org/) ---")
    st, hdrs, body = make_request("PUT", "/api/org/", {
        "name": "GammaOrg Updated",
        "monthly_budget": "500.00",
        "budget_alert_threshold": "85.00"
    }, token=owner_token)
    org.refresh_from_db()
    step3_pass = (
        st == 200 and
        body.get("name") == "GammaOrg Updated" and
        float(body.get("monthly_budget")) == 500.0 and
        float(body.get("budget_alert_threshold")) == 85.0 and
        org.name == "GammaOrg Updated" and
        float(org.monthly_budget) == 500.0 and
        float(org.budget_alert_threshold) == 85.0
    )
    record(3, "Full Update Org (PUT /api/org/)", step3_pass, f"HTTP {st}, DB name: {org.name}, DB budget: {org.monthly_budget}, DB threshold: {org.budget_alert_threshold}")

    # Step 4: PATCH /api/org/
    print("\n--- Step 4: Partial Update Org (PATCH /api/org/) ---")
    st, hdrs, body = make_request("PATCH", "/api/org/", {
        "monthly_budget": "750.00"
    }, token=owner_token)
    org.refresh_from_db()
    step4_pass = (
        st == 200 and
        float(body.get("monthly_budget")) == 750.0 and
        float(org.monthly_budget) == 750.0
    )
    record(4, "Partial Update Org (PATCH /api/org/)", step4_pass, f"HTTP {st}, DB budget: {org.monthly_budget}")

    # Step 5: POST /api/org/invite/
    print("\n--- Step 5: Create Invitation (POST /api/org/invite/) ---")
    st, hdrs, body = make_request("POST", "/api/org/invite/", {
        "email": "gamma_member@example.com",
        "role": "member"
    }, token=owner_token)
    invite_id = body.get("id")
    raw_token = body.get("raw_token")
    inv = Invitation.objects.filter(id=invite_id).first() if invite_id else None
    step5_pass = (
        st == 201 and
        raw_token is not None and
        inv is not None and
        inv.email == "gamma_member@example.com" and
        inv.organization_id == org.id and
        inv.role == "member"
    )
    record(5, "Invite Member (POST /api/org/invite/)", step5_pass, f"HTTP {st}, Invite ID: {invite_id}, Raw Token: {raw_token[:10]}..., DB Org ID: {inv.organization_id if inv else None}")

    # Step 6: GET /api/org/invite/
    print("\n--- Step 6: List Invitations (GET /api/org/invite/) ---")
    st, hdrs, body = make_request("GET", "/api/org/invite/", token=owner_token)
    inv_list = body if isinstance(body, list) else body.get("results", [])
    step6_pass = st == 200 and any(item.get("id") == invite_id for item in inv_list)
    record(6, "List Invites (GET /api/org/invite/)", step6_pass, f"HTTP {st}, Invites count: {len(inv_list)}")

    # Step 7: GET /api/org/invite/{id}/
    print(f"\n--- Step 7: Retrieve Invite (GET /api/org/invite/{invite_id}/) ---")
    st, hdrs, body = make_request("GET", f"/api/org/invite/{invite_id}/", token=owner_token)
    step7_pass = st == 200 and body.get("email") == "gamma_member@example.com" and body.get("role") == "member"
    record(7, "Retrieve Invite (GET /api/org/invite/{id}/)", step7_pass, f"HTTP {st}, Email: {body.get('email')}, Role: {body.get('role')}")

    # Step 8: Create Second Invite & Revoke (DELETE /api/org/invite/{id}/)
    print("\n--- Step 8: Revoke Invite (DELETE /api/org/invite/{id}/) ---")
    st_c, _, body_c = make_request("POST", "/api/org/invite/", {
        "email": "gamma_revoke@example.com",
        "role": "viewer"
    }, token=owner_token)
    revoke_id = body_c.get("id")
    st_del, _, _ = make_request("DELETE", f"/api/org/invite/{revoke_id}/", token=owner_token)
    inv_deleted = not Invitation.objects.filter(id=revoke_id).exists()
    step8_pass = st_del == 204 and inv_deleted
    record(8, "Revoke Invite (DELETE /api/org/invite/{id}/)", step8_pass, f"HTTP {st_del}, DB exists: {not inv_deleted}")

    # Step 9: Member Registers with invite_token
    print("\n--- Step 9: Member Registration via invite_token ---")
    st, hdrs, body = make_request("POST", "/api/auth/register/", {
        "email": "gamma_member@example.com",
        "password": "GammaPass123!",
        "invite_token": raw_token
    })
    member_user = User.objects.filter(email="gamma_member@example.com").first()
    member_mem = Membership.objects.filter(user=member_user, organization=org).first() if member_user else None
    inv.refresh_from_db()
    step9_pass = (
        st == 201 and
        member_user is not None and
        member_mem is not None and
        member_mem.role == "member" and
        member_mem.is_active is True and
        inv.accepted_at is not None
    )
    record(9, "Register with Invite (POST /api/auth/register/)", step9_pass, f"HTTP {st}, User ID: {member_user.id if member_user else None}, DB Role: {member_mem.role if member_mem else None}, Accepted At: {inv.accepted_at}")

    # Obtain Member Token
    st_ml, _, body_ml = make_request("POST", "/api/auth/login/", {
        "email": "gamma_member@example.com",
        "password": "GammaPass123!"
    })
    member_token = body_ml.get("access")

    # Step 10: GET /api/org/members/
    print("\n--- Step 10: List Org Members (GET /api/org/members/) ---")
    st, hdrs, body = make_request("GET", "/api/org/members/", token=owner_token)
    mem_list = body if isinstance(body, list) else body.get("results", [])
    step10_pass = st == 200 and len(mem_list) == 2
    record(10, "List Members (GET /api/org/members/)", step10_pass, f"HTTP {st}, Members count: {len(mem_list)}")

    # Step 11: GET /api/org/members/{id}/
    print(f"\n--- Step 11: Retrieve Member Detail (GET /api/org/members/{member_mem.id}/) ---")
    st, hdrs, body = make_request("GET", f"/api/org/members/{member_mem.id}/", token=owner_token)
    step11_pass = (
        st == 200 and
        body.get("user_email") == "gamma_member@example.com" and
        body.get("role") == "member" and
        body.get("is_active") is True
    )
    record(11, "Retrieve Member (GET /api/org/members/{id}/)", step11_pass, f"HTTP {st}, Email: {body.get('user_email')}, Role: {body.get('role')}")

    # Step 12: POST /api/org/members/ (Add direct member)
    print("\n--- Step 12: Add Member Directly (POST /api/org/members/) ---")
    viewer_user = User.objects.create_user(email="gamma_viewer@example.com", password="GammaPass123!", is_verified=True)
    st, hdrs, body = make_request("POST", "/api/org/members/", {
        "email": "gamma_viewer@example.com",
        "role": "viewer"
    }, token=owner_token)
    viewer_mem_id = body.get("id")
    viewer_mem = Membership.objects.filter(id=viewer_mem_id).first() if viewer_mem_id else None
    step12_pass = st == 201 and viewer_mem is not None and viewer_mem.role == "viewer"
    record(12, "Add Member Directly (POST /api/org/members/)", step12_pass, f"HTTP {st}, DB Mem ID: {viewer_mem_id}, Role: {viewer_mem.role if viewer_mem else None}")

    # Step 13: PATCH /api/org/members/{id}/ (Role Changes & Safeguards)
    print("\n--- Step 13: Member Role Update & Guards (PATCH /api/org/members/{id}/) ---")
    # Guard A: Cannot modify owner role
    st_g1, _, body_g1 = make_request("PATCH", f"/api/org/members/{owner_mem.id}/", {"role": "member"}, token=owner_token)
    # Guard B: Cannot promote member to owner directly
    st_g2, _, body_g2 = make_request("PATCH", f"/api/org/members/{member_mem.id}/", {"role": "owner"}, token=owner_token)
    # Valid Role change: promote gamma_member to admin
    st_patch, _, body_p = make_request("PATCH", f"/api/org/members/{member_mem.id}/", {"role": "admin"}, token=owner_token)
    member_mem.refresh_from_db()
    step13_pass = (
        st_g1 in [400, 403] and
        st_g2 == 400 and
        st_patch == 200 and
        body_p.get("role") == "admin" and
        member_mem.role == "admin"
    )
    record(13, "Update Member Role & Guards (PATCH /api/org/members/{id}/)", step13_pass, f"Owner-guard: HTTP {st_g1}, Promo-guard: HTTP {st_g2}, Update: HTTP {st_patch}, DB Role: {member_mem.role}")

    # Step 14: RBAC Guard: Viewer cannot manage membership
    print("\n--- Step 14: RBAC Restrictions for Viewer ---")
    st_vl, _, body_vl = make_request("POST", "/api/auth/login/", {
        "email": "gamma_viewer@example.com",
        "password": "GammaPass123!"
    })
    viewer_token = body_vl.get("access")
    st_rb1, _, _ = make_request("POST", "/api/org/invite/", {"email": "test@example.com", "role": "viewer"}, token=viewer_token)
    st_rb2, _, _ = make_request("DELETE", f"/api/org/members/{member_mem.id}/", token=viewer_token)
    step14_pass = st_rb1 == 403 and st_rb2 == 403
    record(14, "RBAC Permissions Enforcement", step14_pass, f"Viewer invite attempt: HTTP {st_rb1}, Viewer delete member attempt: HTTP {st_rb2}")

    # Step 15: Member Action transfer_ownership
    print(f"\n--- Step 15: Transfer Ownership via Action (POST /api/org/members/{member_mem.id}/transfer_ownership/) ---")
    st, hdrs, body = make_request("POST", f"/api/org/members/{member_mem.id}/transfer_ownership/", token=owner_token)
    owner_mem.refresh_from_db()
    member_mem.refresh_from_db()
    step15_pass = (
        st == 200 and
        member_mem.role == "owner" and
        owner_mem.role == "admin"
    )
    record(15, "Transfer Ownership Action (POST /api/org/members/{id}/transfer_ownership/)", step15_pass, f"HTTP {st}, New Owner: gamma_member ({member_mem.role}), Old Owner: gamma_owner ({owner_mem.role})")

    # Step 16: Guard: Admin cannot delete owner
    print(f"\n--- Step 16: Guard: Admin cannot remove Owner (DELETE /api/org/members/{member_mem.id}/) ---")
    # owner_mem is now admin, member_mem is now owner
    st_adm_del, _, body_ad = make_request("DELETE", f"/api/org/members/{member_mem.id}/", token=owner_token)
    step16_pass = st_adm_del == 403
    record(16, "Admin Cannot Delete Owner", step16_pass, f"HTTP {st_adm_del}, Response: {body_ad}")

    # Step 17: Standalone POST /api/org/transferownership/
    print("\n--- Step 17: Standalone Transfer Ownership (POST /api/org/transferownership/) ---")
    # Re-login as gamma_member to get fresh token with owner role
    st_ml2, _, body_ml2 = make_request("POST", "/api/auth/login/", {
        "email": "gamma_member@example.com",
        "password": "GammaPass123!"
    })
    member_token = body_ml2.get("access")
    st, hdrs, body = make_request("POST", "/api/org/transferownership/", {
        "new_owner_id": str(owner_user.id)
    }, token=member_token)
    owner_mem.refresh_from_db()
    member_mem.refresh_from_db()
    step17_pass = (
        st == 200 and
        owner_mem.role == "owner" and
        member_mem.role == "admin"
    )
    record(17, "Standalone Transfer Ownership (POST /api/org/transferownership/)", step17_pass, f"HTTP {st}, Owner: gamma_owner ({owner_mem.role}), Member: gamma_member ({member_mem.role})")

    # Re-login as gamma_owner
    st_ol2, _, body_ol2 = make_request("POST", "/api/auth/login/", {
        "email": "gamma_owner@example.com",
        "password": "GammaPass123!"
    })
    owner_token = body_ol2.get("access")

    # Step 18: DELETE /api/org/members/{id}/ (Remove Viewer & Ensure Account No Longer Exists)
    print(f"\n--- Step 18: Remove Member (DELETE /api/org/members/{viewer_mem.id}/) ---")
    st, hdrs, body = make_request("DELETE", f"/api/org/members/{viewer_mem.id}/", token=owner_token)
    user_deleted = not User.objects.filter(id=viewer_user.id).exists()
    mem_deleted = not Membership.objects.filter(id=viewer_mem.id).exists()
    st_login, _, _ = make_request("POST", "/api/auth/login/", {
        "email": "gamma_viewer@example.com",
        "password": "GammaPass123!"
    })
    st_g_mems, _, body_g_mems = make_request("GET", "/api/org/members/", token=owner_token)
    mem_list_after = body_g_mems if isinstance(body_g_mems, list) else body_g_mems.get("results", [])
    active_ids = [m.get("id") for m in mem_list_after if isinstance(m, dict)]
    step18_pass = st == 204 and user_deleted and mem_deleted and st_login in [400, 401] and str(viewer_mem.id) not in active_ids
    record(18, "Remove Member (DELETE /api/org/members/{id}/)", step18_pass, f"HTTP {st}, User deleted: {user_deleted}, Login blocked: {st_login in [400, 401]}, Excluded from list: {str(viewer_mem.id) not in active_ids}")

    # Step 19: DELETE /api/org/ (Soft Delete Organization & update/remove records)
    print("\n--- Step 19: Soft Delete Organization (DELETE /api/org/) ---")
    # Guard: Non-owner cannot delete org
    st_non_owner_del, _, _ = make_request("DELETE", "/api/org/", token=member_token)
    # Owner soft-deletes org
    st_owner_del, _, _ = make_request("DELETE", "/api/org/", token=owner_token)
    org.refresh_from_db()
    # Subsequent GET returns 404
    st_after_get, _, body_after = make_request("GET", "/api/org/", token=owner_token)
    mems_active_count = org.memberships.filter(is_active=True).count()
    inv_count = org.invitations.count()
    from billing.models import APIKey
    keys_active_count = APIKey.objects.filter(organization=org, is_active=True).count()
    records_updated = mems_active_count == 0 and inv_count == 0 and keys_active_count == 0
    step19_pass = (
        st_non_owner_del == 403 and
        st_owner_del == 204 and
        org.is_active is False and
        st_after_get == 404 and
        records_updated
    )
    record(19, "Soft Delete Org (DELETE /api/org/)", step19_pass, f"Non-owner del: HTTP {st_non_owner_del}, Owner del: HTTP {st_owner_del}, DB is_active: {org.is_active}, Subsequent GET: HTTP {st_after_get}, Records cleaned: {records_updated}")

    print("\n" + "=" * 75)
    total_passed = sum(1 for _, _, p, _ in results if p)
    print(f"FINAL RESULT: {total_passed}/{len(results)} steps PASSED successfully!")
    print("=" * 75)

    return all(p for _, _, p, _ in results)

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
