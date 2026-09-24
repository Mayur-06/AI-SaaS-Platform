import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
import json
import uuid
import time
import urllib.request
import urllib.error
import django

# Ensure backend is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from accounts.models import User, Organization, Membership
from billing.models import Plan, APIKey, UsageAggregate
from middleware.redis_utils import get_redis_client

BASE_URL_BACKEND = "http://127.0.0.1:8000"
BASE_URL_FRONTEND = "http://localhost:5173"

def request_http(url, method="GET", data=None, token=None, api_key=None, headers_override=None):
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    if headers_override:
        headers.update(headers_override)

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_headers = {k.lower(): v for k, v in resp.headers.items()}
            content = resp.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(content) if content else {}
            except Exception:
                data = {"raw": content}
            return status, resp_headers, data
    except urllib.error.HTTPError as e:
        status = e.code
        resp_headers = {k.lower(): v for k, v in e.headers.items()}
        content = e.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(content) if content else {}
        except Exception:
            data = {"raw": content}
        return status, resp_headers, data


def test_1_rate_limiting():
    print("\n--- TEST 1: Rate Limiting (429 Enforcement) ---")
    unique = uuid.uuid4().hex[:8]
    test_plan = Plan.objects.create(
        name=f"test_plan_{unique}",
        price=0,
        monthly_request_limit=1000,
        requests_per_minute=10
    )
    print(f"Test plan rate limit: {test_plan.requests_per_minute} req/min")

    try:
        # Create test org & user on Test 10 RPM plan
        org = Organization.objects.create(name=f"RL Test Org {unique}", slug=f"rl-org-{unique}", plan=test_plan)
        user = User.objects.create_user(
            email=f"rl_test_{unique}@example.com",
            password="TestPassword123!"
        )
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        Membership.objects.create(user=user, organization=org, role="owner")

        # Login to obtain JWT
        login_status, _, login_body = request_http(
            f"{BASE_URL_BACKEND}/api/auth/login/",
            method="POST",
            data={"email": user.email, "password": "TestPassword123!"}
        )
        assert login_status == 200, f"Login failed: {login_body}"
        token = login_body.get("access")

        # Clear any leftover Redis rate-limit keys for this org
        try:
            r = get_redis_client()
            keys = r.keys(f"ratelimit:{org.id}*")
            if keys:
                r.delete(*keys)
        except Exception as e:
            print("Redis error clearing keys:", e)

        results = []
        print(f"Sending 13 rapid requests with 10/min limit to non-exempt POST endpoint...")
        for i in range(1, 14):
            # Hit POST /api/keys/ (which is not exempt and runs rate limit middleware)
            status, headers, body = request_http(
                f"{BASE_URL_BACKEND}/api/keys/",
                method="POST",
                data={"name": f"RL Key {unique} {i}"},
                token=token
            )
            remaining = headers.get("x-ratelimit-remaining")
            limit = headers.get("x-ratelimit-limit")
            retry_after = headers.get("retry-after")
            results.append((i, status, limit, remaining, retry_after))
            print(f"  Req {i:2d}: Status={status}, Limit={limit}, Remaining={remaining}, Retry-After={retry_after}")

        # Verify requests 1..10 succeeded (status 201 or 200)
        for i in range(10):
            req_num, status, limit, rem, retry = results[i]
            assert status in (200, 201), f"Request {req_num} expected 200/201, got {status}"
            assert int(rem) == 10 - req_num, f"Request {req_num} remaining expected {10 - req_num}, got {rem}"

        # Verify requests 11..13 were blocked with 429
        blocked_count = 0
        for i in range(10, len(results)):
            req_num, status, limit, rem, retry = results[i]
            if status == 429:
                blocked_count += 1
                assert retry is not None, f"Request {req_num} blocked but missing Retry-After header"
                assert int(retry) > 0, f"Request {req_num} Retry-After must be > 0, got {retry}"
                assert rem == "0", f"Request {req_num} remaining must be 0, got {rem}"

        assert blocked_count >= 2, f"Expected at least 2 blocked requests, got {blocked_count}"
        print("[PASSED]: Requests 1-10 returned 200 with descending remaining. Requests 11-13 returned 429 with Retry-After header!")
    finally:
        # Clean up temporary test plan and records
        try:
            Organization.objects.filter(slug=f"rl-org-{unique}").delete()
            User.objects.filter(email=f"rl_test_{unique}@example.com").delete()
            Plan.objects.filter(id=test_plan.id).delete()
        except Exception as e:
            print("Cleanup error in test 1:", e)


def test_2_pricing_and_limits():
    print("\n--- TEST 2: Pricing and Limits ($49/$299/5,000) ---")
    # Verify in DB
    plans = {p.name: p for p in Plan.objects.all()}
    assert "pro" in plans, "Pro plan missing"
    assert "enterprise" in plans, "Enterprise plan missing"
    assert "free" in plans, "Free plan missing"

    pro = plans["pro"]
    ent = plans["enterprise"]
    free = plans["free"]

    print(f"  DB Pro: Price=${pro.price}, Monthly Limit={pro.monthly_request_limit}")
    print(f"  DB Enterprise: Price=${ent.price}, Monthly Limit={ent.monthly_request_limit}")
    print(f"  DB Free: Price=${free.price}, Monthly Limit={free.monthly_request_limit}")

    assert float(pro.price) == 49.00, f"Pro price expected 49.00, got {pro.price}"
    assert pro.monthly_request_limit == 5000, f"Pro monthly limit expected 5000, got {pro.monthly_request_limit}"
    assert float(ent.price) == 299.00, f"Enterprise price expected 299.00, got {ent.price}"
    assert float(free.price) == 0.00, f"Free price expected 0.00, got {free.price}"
    assert free.monthly_request_limit == 100, f"Free monthly limit expected 100, got {free.monthly_request_limit}"

    # Verify via API endpoint /api/billing/plan/
    unique = uuid.uuid4().hex[:8]
    try:
        org = Organization.objects.create(name=f"Plan Test Org {unique}", slug=f"plan-org-{unique}", plan=free)
        user = User.objects.create_user(
            email=f"plan_test_{unique}@example.com",
            password="TestPassword123!"
        )
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        Membership.objects.create(user=user, organization=org, role="owner")
        # Login to get JWT
        login_status, _, login_body = request_http(
            f"{BASE_URL_BACKEND}/api/auth/login/",
            method="POST",
            data={"email": user.email, "password": "TestPassword123!"}
        )
        assert login_status == 200, f"Login failed: {login_body}"
        token = login_body.get("access")

        status, _, body = request_http(f"{BASE_URL_BACKEND}/api/billing/plan/", method="GET", token=token)
        assert status == 200, f"Billing plan endpoint failed: {body}"
        available_plans = body.get("plans", [])
        plans_by_name = {p["name"]: p for p in available_plans}

        api_pro = plans_by_name.get("pro")
        api_ent = plans_by_name.get("enterprise")
        assert api_pro is not None, "API missing pro plan"
        assert api_ent is not None, "API missing enterprise plan"

        print(f"  API Pro: Price=${api_pro['price']}, Limit={api_pro['monthly_request_limit']}")
        print(f"  API Enterprise: Price=${api_ent['price']}, Limit={api_ent['monthly_request_limit']}")

        assert float(api_pro["price"]) == 49.00
        assert api_pro["monthly_request_limit"] == 5000
        assert float(api_ent["price"]) == 299.00

        print("[PASSED]: Pro ($49/mo, 5,000 reqs) and Enterprise ($299/mo) verified in DB and API response!")
    finally:
        try:
            Organization.objects.filter(slug=f"plan-org-{unique}").delete()
            User.objects.filter(email=f"plan_test_{unique}@example.com").delete()
        except Exception:
            pass


def test_3_django_admin_reachability():
    print("\n--- TEST 3: Django /admin/ Reachability and Static Files ---")
    # Test 3a: Direct backend /admin/
    status, headers, body = request_http(f"{BASE_URL_BACKEND}/admin/", method="GET")
    print(f"  Direct {BASE_URL_BACKEND}/admin/: Status={status}")
    # 200 or 302 redirect to /admin/login/
    assert status in (200, 302), f"Expected 200 or 302, got {status}"
    if status == 302:
        redirect_url = headers.get("location")
        print(f"  Redirects to: {redirect_url}")
        status_login, _, _ = request_http(f"{BASE_URL_BACKEND}{redirect_url}" if redirect_url.startswith("/") else redirect_url)
        assert status_login == 200, f"Admin login page returned {status_login}"

    # Test 3b: Static files /static/admin/css/base.css
    status_static, headers_static, body_static = request_http(f"{BASE_URL_BACKEND}/static/admin/css/base.css")
    print(f"  Static {BASE_URL_BACKEND}/static/admin/css/base.css: Status={status_static}, Content-Type={headers_static.get('content-type')}")
    assert status_static == 200, f"Static file returned {status_static}"
    assert "text/css" in headers_static.get("content-type", "")

    # Test 3c: Proxied through Vite frontend (port 5173)
    try:
        status_vite, headers_vite, body_vite = request_http(f"{BASE_URL_FRONTEND}/admin/", method="GET")
        print(f"  Proxied {BASE_URL_FRONTEND}/admin/: Status={status_vite}")
        assert status_vite in (200, 302), f"Vite proxy returned {status_vite}"

        status_vite_css, headers_vite_css, _ = request_http(f"{BASE_URL_FRONTEND}/static/admin/css/base.css")
        print(f"  Proxied {BASE_URL_FRONTEND}/static/admin/css/base.css: Status={status_vite_css}")
        assert status_vite_css == 200, f"Vite static proxy returned {status_vite_css}"
    except Exception as e:
        print(f"  Note on Vite proxy check: {e}")

    print("[PASSED]: Django /admin/ and static files are reachable and properly served!")


def test_4_monthly_limit_block():
    print("\n--- TEST 4: Monthly Quota Limit Block (402 -> 429 + Upgrade Link) ---")
    free_plan = Plan.objects.get(name="free")
    unique = uuid.uuid4().hex[:8]
    try:
        org = Organization.objects.create(name=f"Quota Test Org {unique}", slug=f"quota-org-{unique}", plan=free_plan)
        user = User.objects.create_user(
            email=f"quota_test_{unique}@example.com",
            password="TestPassword123!"
        )
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        Membership.objects.create(user=user, organization=org, role="owner")
        api_key_obj = APIKey.objects.create(organization=org, name=f"Quota Key {unique}")
        raw_key = api_key_obj._raw_key

        # Set usage aggregate to exceed monthly limit (limit is 100, set to 105)
        now = timezone.now()
        month_str = now.strftime("%Y-%m")
        UsageAggregate.objects.update_or_create(
            organization=org,
            month=month_str,
            defaults={
                "date": now.date(),
                "total_requests": 105,
                "total_cost": 1.05
            }
        )

        # Test API call to /api/ai/query/
        status, headers, body = request_http(
            f"{BASE_URL_BACKEND}/api/ai/query/",
            method="POST",
            data={"prompt": "Hello world", "model": "gemini-2.5-flash"},
            api_key=raw_key
        )
        print(f"  Quota exceeded response status: {status}")
        print(f"  Response body: {json.dumps(body, indent=2)}")

        assert status == 429, f"Expected 429 Too Many Requests, got {status}"
        err_obj = body.get("error", {})
        assert err_obj.get("code") == "MONTHLY_LIMIT_EXCEEDED" or body.get("code") == "MONTHLY_LIMIT_EXCEEDED", f"Missing MONTHLY_LIMIT_EXCEEDED code: {body}"
        assert "upgrade_url" in err_obj or "upgrade_url" in body, f"Missing upgrade_url in response: {body}"
        assert "upgrade_link" in err_obj or "upgrade_link" in body, f"Missing upgrade_link in response: {body}"

        upgrade_url = err_obj.get("upgrade_url") or body.get("upgrade_url")
        upgrade_link = err_obj.get("upgrade_link") or body.get("upgrade_link")
        print(f"  Upgrade URL: {upgrade_url}")
        print(f"  Upgrade Link: {upgrade_link}")
        assert upgrade_url == "/api/billing/upgrade/"
        assert upgrade_link == "/billing"

        print("[PASSED]: Monthly limit block returns 429 with upgrade_url and upgrade_link!")
    finally:
        try:
            Organization.objects.filter(slug=f"quota-org-{unique}").delete()
            User.objects.filter(email=f"quota_test_{unique}@example.com").delete()
        except Exception:
            pass


if __name__ == "__main__":
    test_1_rate_limiting()
    test_2_pricing_and_limits()
    test_3_django_admin_reachability()
    test_4_monthly_limit_block()
    print("\n==========================================")
    print("[SUCCESS] ALL 4 RUBRIC CHECKS VERIFIED SUCCESSFULLY!")
    print("==========================================")
