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
    print("=" * 70)
    print("STARTING E2E TEST SUITE FOR /api/org/ ENDPOINTS")
    print("=" * 70)

    # Clean up any previous test run data
    test_emails = [
        "omega_owner@example.com",
        "omega_member@example.com",
        "omega_viewer@example.com",
        "omega_revoke@example.com"
    ]
    User.objects.filter(email__in=test_emails).delete()
    Organization.objects.filter(name__in=["OmegaCorp", "OmegaCorp Updated"]).delete()

    results = []

    def record(step_name, passed, detail=""):
        results.append((step_name, passed, detail))
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {step_name}: {detail}")

    # Step 1: Register Owner
    print("\n--- Step 1: Owner Registration & Login ---")
    st, hdrs, body = make_request("POST", "/api/auth/register/", {
        "email": "omega_owner@example.com",
        "password": "OmegaPass123!",
        "organization_name": "OmegaCorp"
    })
    owner_token = body.get("tokens", {}).get("access") or body.get("access")
    # Verify in DB
    owner_user = User.objects.filter(email="omega_owner@example.com").first()
    org = Organization.objects.filter(name="OmegaCorp").first()
    owner_mem = Membership.objects.filter(user=owner_user, organization=org, role="owner").first() if owner_user and org else None
    
    step1_pass = st == 201 and owner_token is not None and owner_user is not None and owner_mem is not None
    record("Step 1: Register Owner", step1_pass, f"HTTP {st}, Org ID: {org.id if org else None}, Owner ID: {owner_user.id if owner_user else None}")

    # Check RateLimit and Request-ID headers on authenticated request
    print("\n--- Step 2: GET /api/org/ ---")
    st, hdrs, body = make_request("GET", "/api/org/", token=owner_token)
    req_id = hdrs.get("x-request-id") or hdrs.get("X-Request-ID")
    rl_limit = hdrs.get("x-ratelimit-limit") or hdrs.get("X-RateLimit-Limit")
    rl_rem = hdrs.get("x-ratelimit-remaining") or hdrs.get("X-RateLimit-Remaining")
    rl_reset = hdrs.get("x-ratelimit-reset") or hdrs.get("X-RateLimit-Reset")

    step2_pass = (
        st == 200 and
        body.get("name") == "OmegaCorp" and
        body.get("is_active") is True and
        req_id is not None and
        rl_limit is not None
    )
    record("Step 2: GET /api/org/", step2_pass, f"HTTP {st}, X-Request-ID: {req_id}, Limit: {rl_limit}, Remaining: {rl_rem}")

    # Step 3: PUT /api/org/
    print("\n--- Step 3: PUT /api/org/ ---")
    st, hdrs, body = make_request("PUT", "/api/org/", {
        "name": "OmegaCorp Updated",
        "monthly_budget": "500.00",
        "budget_alert_threshold": "85.00"
    }, token=owner_token)
    org.refresh_from_db()
    step3_pass = (
        st == 200 and
        body.get("name") == "OmegaCorp Updated" and
        float(body.get("monthly_budget")) == 500.0 and
        org.name == "OmegaCorp Updated" and
        float(org.monthly_budget) == 500.0 and
        float(org.budget_alert_threshold) == 85.0
    )
    record("Step 3: PUT /api/org/", step3_pass, f"HTTP {st}, DB Name: {org.name}, DB Budget: {org.monthly_budget}")

    # Step 4: PATCH /api/org/
    print("\n--- Step 4: PATCH /api/org/ ---")
    st, hdrs, body = make_request("PATCH", "/api/org/", {
        "monthly_budget": "750.00"
    }, token=owner_token)
    org.refresh_from_db()
    step4_pass = (
        st == 200 and
        float(body.get("monthly_budget")) == 750.0 and
        float(org.monthly_budget) == 750.0
    )
    record("Step 4: PATCH /api/org/", step4_pass, f"HTTP {st}, DB Budget: {org.monthly_budget}")

    # Step 5: POST /api/org/invite/
    print("\n--- Step 5: POST /api/org/invite/ ---")
    st, hdrs, body = make_request("POST", "/api/org/invite/", {
        "email": "omega_member@example.com",
        "role": "member"
    }, token=owner_token)
    invite_id = body.get("id")
    raw_token = body.get("raw_token")
    # Verify in DB
    inv = Invitation.objects.filter(id=invite_id).first() if invite_id else None
    step5_pass = (
        st == 201 and
        raw_token is not None and
        inv is not None and
        inv.email == "omega_member@example.com" and
        inv.role == "member"
    )
    record("Step 5: POST /api/org/invite/", step5_pass, f"HTTP {st}, Invite ID: {invite_id}, Raw Token: {raw_token[:10]}...")

    # Step 6: GET /api/org/invite/
    print("\n--- Step 6: GET /api/org/invite/ ---")
    st, hdrs, body = make_request("GET", "/api/org/invite/", token=owner_token)
    inv_list = body if isinstance(body, list) else body.get("results", [])
    step6_pass = st == 200 and any(item.get("id") == invite_id for item in inv_list)
    record("Step 6: GET /api/org/invite/", step6_pass, f"HTTP {st}, Found {len(inv_list)} invitations")

    # Step 7: GET /api/org/invite/{id}/
    print(f"\n--- Step 7: GET /api/org/invite/{invite_id}/ ---")
    st, hdrs, body = make_request("GET", f"/api/org/invite/{invite_id}/", token=owner_token)
    step7_pass = st == 200 and body.get("email") == "omega_member@example.com"
    record("Step 7: GET /api/org/invite/{id}/", step7_pass, f"HTTP {st}, Email: {body.get('email')}")

    # Step 8: Second invite & DELETE /api/org/invite/{id}/
    print("\n--- Step 8: DELETE /api/org/invite/{id}/ (Revoke Invite) ---")
    st_c, _, body_c = make_request("POST", "/api/org/invite/", {
        "email": "omega_revoke@example.com",
        "role": "viewer"
    }, token=owner_token)
    revoke_id = body_c.get("id")
    st_del, _, _ = make_request("DELETE", f"/api/org/invite/{revoke_id}/", token=owner_token)
    inv_deleted = not Invitation.objects.filter(id=revoke_id).exists()
    step8_pass = st_del == 204 and inv_deleted
    record("Step 8: DELETE /api/org/invite/{id}/", step8_pass, f"HTTP {st_del}, DB Exists: {not inv_deleted}")

    # Step 9: Member Registers with invite_token
    print("\n--- Step 9: POST /api/auth/register/ with invite_token ---")
    st, hdrs, body = make_request("POST", "/api/auth/register/", {
        "email": "omega_member@example.com",
        "password": "MemberPass123!",
        "invite_token": raw_token
    })
    member_token = body.get("tokens", {}).get("access") or body.get("access")
    member_user = User.objects.filter(email="omega_member@example.com").first()
    member_mem = Membership.objects.filter(user=member_user, organization=org).first() if member_user else None
    inv.refresh_from_db()

    step9_pass = (
        st == 201 and
        member_user is not None and
        member_mem is not None and
        member_mem.role == "member" and
        inv.accepted_at is not None
    )
    record("Step 9: Member Registration with Invite", step9_pass, f"HTTP {st}, User ID: {member_user.id if member_user else None}, Accepted At: {inv.accepted_at}")

    # If token wasn't returned on register, log in to obtain it
    if not member_token:
        st_l, _, body_l = make_request("POST", "/api/auth/login/", {
            "email": "omega_member@example.com",
            "password": "MemberPass123!"
        })
        member_token = body_l.get("access")

    # Step 10: GET /api/org/members/
    print("\n--- Step 10: GET /api/org/members/ ---")
    st, hdrs, body = make_request("GET", "/api/org/members/", token=owner_token)
    mem_list = body if isinstance(body, list) else body.get("results", [])
    step10_pass = st == 200 and len(mem_list) == 2
    record("Step 10: GET /api/org/members/", step10_pass, f"HTTP {st}, Member count: {len(mem_list)}")

    # Step 11: GET /api/org/members/{id}/
    print(f"\n--- Step 11: GET /api/org/members/{member_mem.id}/ ---")
    st, hdrs, body = make_request("GET", f"/api/org/members/{member_mem.id}/", token=owner_token)
    step11_pass = st == 200 and body.get("user_email") == "omega_member@example.com"
    record("Step 11: GET /api/org/members/{id}/", step11_pass, f"HTTP {st}, Email: {body.get('user_email')}, Role: {body.get('role')}")

    # Step 12: POST /api/org/members/ (Direct member addition)
    print("\n--- Step 12: POST /api/org/members/ (Add direct member) ---")
    viewer_user = User.objects.create_user(email="omega_viewer@example.com", password="ViewerPass123!", is_verified=True)
    st, hdrs, body = make_request("POST", "/api/org/members/", {
        "email": "omega_viewer@example.com",
        "role": "viewer"
    }, token=owner_token)
    viewer_mem_id = body.get("id")
    viewer_mem = Membership.objects.filter(id=viewer_mem_id).first() if viewer_mem_id else None
    step12_pass = st == 201 and viewer_mem is not None and viewer_mem.role == "viewer"
    record("Step 12: POST /api/org/members/", step12_pass, f"HTTP {st}, Viewer Mem ID: {viewer_mem_id}")

    # Step 13: PATCH /api/org/members/{id}/ (Role changes and Guards)
    print("\n--- Step 13: PATCH /api/org/members/{id}/ (Role Updates & Guards) ---")
    # Guard A: Cannot modify owner role
    st_g1, _, _ = make_request("PATCH", f"/api/org/members/{owner_mem.id}/", {"role": "member"}, token=owner_token)
    guard1_ok = st_g1 in [400, 403]
    # Guard B: Cannot promote to owner directly via PATCH
    st_g2, _, _ = make_request("PATCH", f"/api/org/members/{member_mem.id}/", {"role": "owner"}, token=owner_token)
    guard2_ok = st_g2 == 400
    # Valid Role Change: Promote member to admin
    st_patch, _, body_p = make_request("PATCH", f"/api/org/members/{member_mem.id}/", {"role": "admin"}, token=owner_token)
    member_mem.refresh_from_db()
    step13_pass = guard1_ok and guard2_ok and st_patch == 200 and member_mem.role == "admin"
    record("Step 13: PATCH /api/org/members/{id}/", step13_pass, f"Guard1: {st_g1}, Guard2: {st_g2}, Update HTTP: {st_patch}, DB Role: {member_mem.role}")

    # Step 14: RBAC Check: Viewer cannot manage members
    print("\n--- Step 14: RBAC Enforcement ---")
    _, _, body_vl = make_request("POST", "/api/auth/login/", {
        "email": "omega_viewer@example.com",
        "password": "ViewerPass123!"
    })
    viewer_token = body_vl.get("access")
    st_rbac1, _, _ = make_request("POST", "/api/org/invite/", {"email": "test@example.com", "role": "viewer"}, token=viewer_token)
    st_rbac2, _, _ = make_request("DELETE", f"/api/org/members/{member_mem.id}/", token=viewer_token)
    step14_pass = st_rbac1 == 403 and st_rbac2 == 403
    record("Step 14: RBAC Viewer Restrictions", step14_pass, f"Invite HTTP: {st_rbac1}, Delete HTTP: {st_rbac2}")

    # Step 15: Transfer Ownership via Action: POST /api/org/members/{id}/transfer_ownership/
    print("\n--- Step 15: Member Action transfer_ownership ---")
    st, hdrs, body = make_request("POST", f"/api/org/members/{member_mem.id}/transfer_ownership/", token=owner_token)
    owner_mem.refresh_from_db()
    member_mem.refresh_from_db()
    step15_pass = (
        st == 200 and
        member_mem.role == "owner" and
        owner_mem.role == "admin"
    )
    record("Step 15: Action transfer_ownership", step15_pass, f"HTTP {st}, New Owner: {member_mem.user.email} ({member_mem.role}), Old Owner Role: {owner_mem.role}")

    # Step 16: Guard: Admin cannot delete Owner
    print("\n--- Step 16: Admin cannot remove Owner ---")
    # Now owner_mem is admin, member_mem is owner
    st_del_owner, _, _ = make_request("DELETE", f"/api/org/members/{member_mem.id}/", token=owner_token)
    step16_pass = st_del_owner == 403
    record("Step 16: Admin cannot remove Owner", step16_pass, f"HTTP {st_del_owner}")

    # Step 17: Transfer Ownership back via Standalone View: POST /api/org/transferownership/
    print("\n--- Step 17: Standalone POST /api/org/transferownership/ ---")
    # Re-login as omega_member to get refreshed token with owner role
    st_ml, _, body_ml = make_request("POST", "/api/auth/login/", {
        "email": "omega_member@example.com",
        "password": "MemberPass123!"
    })
    member_token = body_ml.get("access")
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
    record("Step 17: Standalone transferownership", step17_pass, f"HTTP {st}, Owner Role: {owner_mem.role}, Member Role: {member_mem.role}")

    # Re-login as omega_owner
    st_ol, _, body_ol = make_request("POST", "/api/auth/login/", {
        "email": "omega_owner@example.com",
        "password": "OmegaPass123!"
    })
    owner_token = body_ol.get("access")

    # Step 18: DELETE /api/org/members/{id}/ (Remove Viewer)
    print("\n--- Step 18: DELETE /api/org/members/{id}/ ---")
    st, hdrs, body = make_request("DELETE", f"/api/org/members/{viewer_mem.id}/", token=owner_token)
    viewer_mem.refresh_from_db()
    step18_pass = st == 204 and viewer_mem.is_active is False
    record("Step 18: DELETE member", step18_pass, f"HTTP {st}, DB is_active: {viewer_mem.is_active}")

    # Step 19: DELETE /api/org/ (Soft delete org)
    print("\n--- Step 19: DELETE /api/org/ (Soft delete org) ---")
    # Non-owner cannot delete
    st_m_del, _, _ = make_request("DELETE", "/api/org/", token=member_token)
    guard_org_del = st_m_del == 403

    # Owner deletes
    st_o_del, _, _ = make_request("DELETE", "/api/org/", token=owner_token)
    org.refresh_from_db()
    
    # Subsequent GET returns 404
    st_after, _, _ = make_request("GET", "/api/org/", token=owner_token)
    step19_pass = guard_org_del and st_o_del == 204 and org.is_active is False and st_after == 404
    record("Step 19: DELETE /api/org/", step19_pass, f"Member Del: {st_m_del}, Owner Del: {st_o_del}, DB is_active: {org.is_active}, After GET: {st_after}")

    print("\n" + "=" * 70)
    total_passed = sum(1 for _, p, _ in results if p)
    print(f"RESULTS: {total_passed}/{len(results)} steps passed.")
    print("=" * 70)

    return all(p for _, p, _ in results)

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
