# Phase 1 — Backend Foundation & Complete API Surface: Endpoint Architecture

## Decision: ViewSets + @action vs APIView

- **ViewSets with `@action`** for resource-centric logic (e.g., `APIKeyViewSet` with `@action(detail=True, methods=['post'])` for `regenerate`)
- **Standalone `APIView` subclasses** for resource-agnostic or complex RPC-style endpoints (e.g., `AIQueryView` for POST /api/ai/query/)

## App Structure

Five Django apps per §2.1:

- `accounts`: auth, org, members, invitations
- `billing`: plans, API keys, usage, invoices
- `ai_service`: documents, query, history, cache, models, routing
- `middleware`: org context, rate limit, request ID
- `core`: shared permissions, exceptions, serializers, admin, health

## Endpoint Map & Implementation Pattern

### accounts/

**ViewSets (DRF routers):**
- `MemberViewSet` → `/api/org/members/` — list, create, retrieve, PATCH, DELETE
  - Role enforcement: owner cannot be removed or transferred by admin; members/viewers cannot manage membership per §11.5
- `InvitationViewSet` → `/api/org/invite/` — list, create, retrieve, destroy

**Standalone APIViews (explicit urlpatterns):**
- `OrganizationView` → GET/PUT `/api/org/`
- `TransferOwnershipView` → POST `/api/org/transfer-ownership/`
- `OrganizationDeleteView` → DELETE `/api/org/`
- `AuthRegisterView` → POST `/api/auth/register/`
- `AuthLoginView` → POST `/api/auth/login/`
- `AuthRefreshView` → POST `/api/auth/refresh/`
- `AuthPasswordResetView` → POST `/api/auth/password-reset/`
- `AuthPasswordResetConfirmView` → POST `/api/auth/password-reset/confirm/`
- `AuthVerifyView` → GET `/api/auth/verify/{token}/`

### billing/

**ViewSets (DRF routers):**
- `APIKeyViewSet` → `/api/keys/` — list, create, retrieve, PATCH, destroy
  - `@action(detail=True, methods=['post'])` → `POST /api/keys/{id}/regenerate/`
  - `PATCH /api/keys/{id}/` supports key rename, permission changes, and rate-limit override updates per §11.2
- `InvoiceViewSet` → `/api/billing/invoices/` — list, retrieve

**Standalone APIViews (explicit urlpatterns):**
- `BillingPlanView` → GET `/api/billing/plan/`
- `BillingUpgradeView` → POST `/api/billing/upgrade/`
- `BillingUsageView` → GET `/api/billing/usage/`
- `BillingUsageExportView` → GET `/api/billing/usage/export/`

### ai_service/

**ViewSets (DRF routers):**
- `DocumentViewSet` → `/api/ai/documents/` — list, create, retrieve, destroy

**Standalone APIViews (explicit urlpatterns):**
- `AIQueryView` → POST `/api/ai/query/`
- `AIHistoryView` → GET `/api/ai/history/`
- `CacheStatsView` → GET `/api/cache/stats/`
- `CacheClearView` → DELETE `/api/cache/clear/`

### core/

**Standalone APIViews (explicit urlpatterns):**
- `AdminTenantsView` → GET `/api/admin/tenants/`
- `AdminUsageView` → GET `/api/admin/usage/`
- `AdminHealthView` → GET `/api/admin/health/`
- `PublicHealthView` → GET `/api/health/`

## URL Configuration

`config/urls.py` wires app URLconfs under `/api/`:

```python
urlpatterns = [
    path('api/auth/', include('accounts.urls')),
    path('api/org/', include('accounts.org_urls')),
    path('api/keys/', include('billing.urls')),
    path('api/billing/', include('billing.billing_urls')),
    path('api/ai/', include('ai_service.urls')),
    path('api/cache/', include('ai_service.cache_urls')),
    path('api/admin/', include('core.admin_urls')),
    path('api/health/', PublicHealthView.as_view()),
]
```

Each app exposes a `urls.py` that includes DRF router URLs plus explicit APIView patterns.

## Implementation Order

1. **accounts** (models → serializers → views → urls) — foundation for auth and org context
2. **middleware** (org context, request ID, rate limit) — depends on accounts models
3. **billing** (models → keys → billing views) — depends on accounts for org context
4. **ai_service** (models → documents → cache → query) — depends on billing for quota and rate limit
5. **core** (admin, health) — depends on all others for metrics
6. **Top-level URL wiring**, CORS, and OpenAPI schema

## Key Design Notes

- All APIViews must enforce authentication and organization scoping manually
- ViewSets inherit from `OrgScopedViewSet` which sets `queryset = Model.objects.filter(organization=request.organization)` and enforces ownership validation on writes
- Rate limiting middleware wraps the entire API path
- Monthly quota check happens in `AIQueryView` and `BillingUsageView`
- The AI query endpoint and its middleware chain (rate-limit, org-context) run under ASGI (uvicorn) per §12 Fix #2; auth, org, and billing views may remain sync DRF

## Defaults for Unspecified Decisions

- Settings: single `settings.py` with `django-environ`
- Test runner: `pytest-django`
- Development: run Django directly via `manage.py runserver`; Docker Compose for integration testing and deployment
- LLM clients: official SDKs (`openai`, `google-generativeai`) with httpx transport for connection pooling
- Embeddings: local `sentence-transformers` in web service
- Django: 4.2.11 (latest patch in 4.2 series)
- DRF: 3.15.2
- ASGI: run entire Django app under `uvicorn`; sync views handled automatically

## Dependencies

```
Django==4.2.11
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.3.1
django-environ==0.11.2
psycopg2-binary==2.9.9
redis==5.0.1
httpx==0.27.0
sentence-transformers==2.7.0
pgvector==0.2.4
drf-spectacular==0.27.2
pytest==8.1.1
pytest-django==4.8.0
openai==1.14.0
google-generativeai==0.5.0
```

## Docker Compose

```yaml
services:
  web:
    build: .
    command: uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 4
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=saas
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
volumes:
  pgdata:
```
