# **Implementation Plan AI SaaS Platform with Multi-Tenancy** 

## **1. System Architecture** 

The platform will be organized as a multi-tenant SaaS application with Django REST Framework as the API layer, PostgreSQL as the source-of-truth database, Redis for rate limiting and semantic-cache storage, and a React frontend. Docker Compose will orchestrate the services. 

- Frontend: React (Vite) with React Router, Tailwind CSS, shadcn/ui-compatible components, Recharts, Axios, React Hook Form, Zod, and Zustand. 

- Backend: Django 4.2+, Django REST Framework, SimpleJWT, django-cors-headers, Celery-ready service boundaries if asynchronous work is later required. 

- Database: PostgreSQL with Django ORM and migrations. 

- Infrastructure: Docker Compose with web, db, and redis services; optional frontend service for a fully containerized deployment. 

- External AI providers: Gemini Flash for Free, GPT-4o-mini for Pro, GPT-4 for Enterprise, with configurable fallback chains. 

- AI feature selected: Retrieval-Augmented Generation (RAG) chatbot, reused from the existing prior-assignment implementation (document ingestion, chunking, embedding, retrieval, and answer generation). This SaaS layer wraps that existing pipeline with auth, multi-tenancy, billing, rate limiting, semantic caching, and model routing — it does not replace it. 

Request flow: React client → JWT/API-key authentication → organization context → monthly quota check → Redis slidingwindow rate limit → semantic-cache lookup → model router → LLM provider → usage/cost logging → response. 

## **2. Backend Implementation Plan** 

### **2.1 Django Applications** 

- accounts: custom user, organizations, memberships, invitations, authentication, roles, and organization settings. 

- billing: plans, API keys, usage logs, monthly aggregates, invoices, and pricing configuration. 

- ai_service: AI query endpoint, model configuration, semantic-cache service, LLM clients, routing, fallback, cost calculation, and the RAG pipeline (org-scoped document ingestion, chunking, embedding, and retrieval, adapted from the existing implementation). 

- middleware: organization context, API-key authentication, rate limiting, and monthly usage enforcement. 

- common/core: shared permissions, exceptions, serializers, pagination, audit helpers, and health checks. 

### **2.2 Authentication and Authorization** 

- Use email-based authentication and Django password hashing. 

- Register creates a user, organization, and owner membership. 

- Login returns a 15-minute access token and a 7-day refresh token. 

- Include user_id, org_id, and role in JWT claims. 

- Rotate refresh tokens and blacklist old refresh tokens. 

- Implement mock email verification and password reset by logging tokens to the console. 

- Create role permissions: owner, admin, member, and viewer. 

- Use DRF permission classes for role checks; never rely only on frontend hiding buttons. 

### **2.3 Multi-Tenancy and Data Isolation** 

- Every tenant-owned model must contain organization_id as a foreign key. 

- Add an OrgScopedQuerySet/OrgScopedManager that automatically filters by request organization where appropriate. 

- Set request.organization in organization-context middleware after JWT or API-key authentication. 

- In every ViewSet, scope get_queryset() to request.organization and validate object ownership on writes. 

- Prevent cross-tenant access through IDs, API keys, cache keys, exports, and admin endpoints. 

- Add automated tests creating Org A and Org B and verifying that neither can read, modify, or clear the other's data. 

### **2.4 API Key Management** 

- Generate a cryptographically secure key with a sk_live_ prefix. 

- Return the complete key only in the creation response; store only bcrypt hash and first-12-character prefix. 

- Authenticate Bearer API keys through a dedicated authentication class or middleware. 

- Store permissions, optional lower rate-limit override, active status, created_at, and last_used_at. 

- Revoke immediately by setting is_active=False; never delete audit evidence unnecessarily. 

- Use constant-time hash comparison and avoid logging full keys. 

## **3. Database Design** 

PostgreSQL is the authoritative store for identity, tenant ownership, configuration, usage, billing, and audit data. Redis is not used as the source of truth for billing or authorization. 

**User:** id, email, password_hash, is_verified, is_staff, created_at 

**Organization:** id, name, slug, plan_id, stripe_customer_id, is_active, created_at 

**Membership:** id, user_id, organization_id, role, joined_at, invited_by_id 

**Invitation:** id, organization_id, email, role, token_hash, expires_at, accepted_at 

**Plan:** id, name, monthly_request_limit, requests_per_minute, cache_ttl_seconds, price 

**APIKey:** id, organization_id, name, key_prefix, key_hash, permissions, rate_limit_override, last_used_at, is_active 

**ModelConfig:** id, name, provider, input_cost_per_1k, output_cost_per_1k, is_active 

**RoutingRule:** id, plan_id, primary_model_id, fallback_model_ids, timeout_seconds 

**UsageLog:** id, organization_id, user_id, api_key_id, endpoint, model_used, input_tokens, output_tokens, latency_ms, estimated_cost, cache_hit, timestamp 

**UsageAggregate:** id, organization_id, date, month, total_requests, input_tokens, output_tokens, total_cost, cache_hits, cache_savings 

**CacheEntry:** id, organization_id, cache_key, query_text, model, response_text, token metadata, created_at, expires_at 

**Document:** id, organization_id, filename, status, uploaded_by_id, created_at 

**DocumentChunk:** id, document_id, organization_id, chunk_text, embedding_vector, chunk_index, created_at 

**Invoice:** id, organization_id, period_start, period_end, amount, status, created_at 

- Add indexes on organization_id, timestamp, month, api_key_id, and active/status fields. 

- Use unique constraints for organization slug, a single active membership per user (per the assignment's one-org-per-user simplification; multi-org is out of scope unless pursued as a bonus), and active key prefix where appropriate. 

- Use database transactions for registration, key creation, plan changes, and usage aggregation updates. 

- Keep pricing in ModelConfig so cost calculations are not hardcoded. 

- Store DocumentChunk embeddings in PostgreSQL via the pgvector extension (no new Docker service required, keeping Docker to the mandatory web/db/redis three). Document and DocumentChunk are tenant-owned models and follow the same organization_id filtering and isolation rules as every other model in §2.3 — retrieval must never return another org's chunks. 

## **4. Semantic Cache Implementation** 

- Embed each incoming query with sentence-transformers/all-MiniLM-L6-v2. 

- Normalize embeddings and compare using cosine similarity. 

- Use Redis as the cache store; namespace all keys by organization. 

- Suggested Redis structure: semantic:{org_id}:{entry_id} for metadata/embedding and semantic:index:{org_id} for entry IDs. 

- On lookup, retrieve only entries belonging to the current organization, compare embeddings, and select the highest score. 

- Treat similarity > 0.95 as a hit initially; make the threshold configurable for admins. 

- On a hit, return the cached response with cache_hit=true, zero LLM cost, and cache metadata. 

- On a miss, call the model, then store query text, embedding bytes, response, model, token counts, and expiry. 

- Apply TTL by plan: Free 1 hour, Pro 24 hours, Enterprise 7 days. 

- Track total queries, hits, misses, hit rate, and estimated savings in PostgreSQL aggregates or Redis counters. 

- Invalidate or clear only the current organization's cache. 

Practical implementation: begin with brute-force comparison because the assignment expects a small cache. Introduce FAISS or a vector index only if cache size makes linear comparison slow. Add a cache version/model fingerprint so responses are not reused after prompt or model changes. 

Note: this semantic cache (ephemeral, Redis, TTL-based) is separate from the RAG retrieval index (persistent, PostgreSQL/pgvector, no TTL). The cache stores query→final-answer pairs to skip the LLM call entirely; the retrieval index stores document chunks used to build the augmented prompt on a cache miss. They may use different embedding models and are not interchangeable. 

## **5. Rate Limiting Implementation** 

- Implement a Django middleware or DRF-compatible throttling layer backed by Redis. 

- Use a sliding-window sorted set: remove timestamps older than 60 seconds, add the current request timestamp, count members, and reject when the effective limit is exceeded. 

- Use Redis atomic pipelines/Lua to avoid race conditions under concurrent requests. 

- Key pattern: ratelimit:{org_id}:{minute_window}, per the assignment’s specification, with a 2-minute TTL for automatic cleanup; when per-key isolation is required, extend to ratelimit:{org_id}:{api_key_id}:{minute_window}. 

- Effective limit = the lower of the plan limit and an API-key override. 

- Plan limits: Free 10/min, Pro 60/min, Enterprise 300/min. 

- Return X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on normal responses and Retry-After on 429. 

- Skip static files and non-API routes. 

- Return JSON errors with a stable code such as RATE_LIMIT_EXCEEDED. 

- Keep monthly quota enforcement separate from per-minute rate limiting. 

## **6. Model Routing and Fallback** 

- Store model-to-plan mapping in ModelConfig and RoutingRule rather than hardcoding it in views. 

- Free → Gemini Flash; Pro → GPT-4o-mini; Enterprise → GPT-4. 

- Define ordered fallback chains, for example primary → secondary → cheapest tertiary. 

- Use httpx clients with connection pooling, provider-specific adapters, and a 10-second timeout. 

- Retry only transient failures with bounded exponential backoff; do not retry invalid requests. 

- Log provider, model, attempt number, latency, failure reason, and final selected model. 

- If all models fail, return HTTP 503 with a safe user-facing message and request ID. 

- For Enterprise custom routing, store organization-level preferences and validate that selected models are permitted. 

## **7. AI Query Orchestration** 

The core endpoint should be thin; business logic belongs in services. 

- Authenticate user or API key. 

- Resolve organization and effective permissions. 

- Check organization active status and monthly request quota. 

- Apply Redis rate limiting. 

- Validate and normalize query input. 

- Attempt semantic-cache lookup. 

- If hit: build response metadata, record zero-cost usage, and return. 

- If miss: retrieve the top-k relevant chunks from the organization’s document store (RAG retrieval, org-scoped), build the augmented prompt, then select the model route and execute the fallback chain. 

- Calculate token-based cost from ModelConfig pricing. 

- Persist UsageLog and update daily/monthly aggregates. 

- Store successful response in semantic cache. 

- Return response, model, token counts, latency, estimated cost, cache status, and request ID. 

## **8. API Endpoint Plan** 

- POST /api/auth/register/, /login/, /refresh/, /password-reset/, /password-reset/confirm/ 

- GET /api/auth/verify/{token}/ 

- GET/PUT /api/org/ 

- GET/POST/DELETE /api/org/members/ 

- POST /api/org/invite/ 

- GET/POST /api/keys/; DELETE /api/keys/{id}/ 

- POST /api/ai/query/ 

- GET/POST /api/ai/documents/; DELETE /api/ai/documents/{id}/ (org-scoped RAG document upload/list/removal) 

- GET /api/billing/plan/; POST /api/billing/upgrade/ 

- GET /api/billing/usage/; GET /api/billing/invoices/ 

- GET /api/cache/stats/; DELETE /api/cache/clear/ 

- GET /api/admin/tenants/; GET /api/admin/usage/; GET /api/admin/health/ 

- GET /api/health/ 

## **9. Frontend Implementation Plan — React (Vite)** 

The assignment requires React. This implementation uses React with Vite and React Router, Tailwind CSS, shadcn/ui, and client components where interactivity is required. 

- Core stack: React 18+ (Vite), React Router, Tailwind CSS, shadcn/ui-style components, Axios, Zustand, React Hook Form, Zod, and Recharts. 

- Create an Axios instance with access-token injection, refresh-token handling, and centralized 401/429/5xx error handling. 

- Prefer secure httpOnly cookies for production authentication; if localStorage is required for the assignment demo, document the trade-off and use short-lived access tokens. 

- Protect authenticated routes with a route guard and redirect unauthenticated users to /login. 

- Keep organization, user, role, plan, and usage data in a small Zustand store; fetch authoritative data from the backend. 

- Build responsive layouts with a sidebar after login, top plan badge, organization selector placeholder, and mobile navigation. Use the assignment's seven screens: authentication, dashboard, AI query, billing, API keys, organization settings, and superadmin panel. 

### **9.1 React (Vite) Project Structure** 

- src/pages: auth, dashboard, ai, billing, keys, settings, admin route components, wired up in src/routes.tsx with React Router; src/components; src/lib/api.ts; src/store. 

- src/components/auth: LoginForm, RegisterForm, PasswordResetForm. 

- src/components/dashboard: KpiCard, UsageChart, QuickActions. 

- src/components/ai: QueryInput, ResponseCard, QueryHistory. 

- src/components/billing: PlanCard, UsageBreakdown, CostSummary, CacheStats. 

- src/components/keys: KeyList, CreateKeyModal, KeyRevealDialog. 

- src/components/org: MemberList, InviteModal, RoleSelect. 

- src/components/admin: TenantTable, PlatformMetrics, HealthPanel, RoutingConfig. 

- src/services: api.ts, authService.ts, billingService.ts, aiService.ts. 

- src/store: authStore.ts, orgStore.ts, billingStore.ts. 

### **9.2 Required Screens** 

- Authentication: centered login/register/reset cards; registration includes email, password, confirmation, and organization name. 

- Dashboard: monthly requests, remaining quota, cache hit rate, estimated cost, 30-day usage chart, and quick AI query. 

- AI Query: textarea, send button, response, model badge, token counts, latency, cost, cache hit/miss, cited source chunks (RAG), a document upload/list panel scoped to the org, and last 10 queries. 

- Billing: current plan, comparison cards, usage/cost charts, cache savings, daily table, and cost projection. 

- API Keys: prefix-only list, create modal, one-time full-key reveal/copy, permissions, revoke, regenerate, and curl/Python examples. 

- Organization Settings: organization data, members, roles, invitations, ownership transfer, and danger zone. 

- Admin: tenant table, platform metrics, health, and editable routing configuration. 

## **10. Testing and Acceptance Checklist** 

- Two organizations cannot access each other's users, queries, usage, API keys, documents, retrieved chunks, or cache entries. 

- Free plan blocks the 101st monthly request and returns usage information. 

- Rate limits trigger at 10/min, 60/min, and 300/min respectively, with correct headers. 

- API key full value is shown once, hashed in the database, and revoked keys immediately return 401. 

- Repeating an identical or sufficiently similar query produces a cache hit and zero LLM cost. 

- Cache entries expire according to plan TTL and never cross organization boundaries. 

- Primary model failure invokes fallback and records the event. 

- Usage logs contain tokens, model, latency, cache flag, and calculated cost. 

- Dashboard charts match database aggregates. 

- docker-compose down -v && docker-compose up -d starts a clean working installation. 

- Django Admin exposes all required models and admin-only endpoints are protected. 

## **11. Corrections and Assignment Coverage** 

- Frontend decision: the implementation uses React with Vite and React Router throughout (no Next.js App Router). 

- Invitation flow: an invited user must be able to register with the invitation token and join the existing organization instead of creating a new organization. 

- Role enforcement: owner, admin, member, and viewer permissions must be enforced server-side. Viewer is read-only; member can use the AI API and view the dashboard; admin cannot remove or transfer the owner. 

- Usage warnings: emit X-Usage-Warning at 80% of the monthly limit and block at 100%. Enterprise remains unlimited for requests but still tracks cost. 

- Budget alerts: add an organization budget field/setting and expose budget remaining and projected monthly spend. This covers the assignment's budget-alert requirement. 

- Auditability: log API-call details including authentication source (user or API key), key ID when applicable, provider, model, fallback attempts, latency, tokens, cost, cache status, and request ID. Never log full API keys or passwords. 

- Admin coverage: register Organization, Membership, Plan, APIKey, UsageLog, CacheEntry, ModelConfig, RoutingRule, Invitation, UsageAggregate, and Invoice in Django Admin; protect admin APIs with superadmin permissions. 

- Operational correctness: make usage increments and monthly-limit checks atomic or transaction-safe to prevent concurrent requests from exceeding the Free/Pro quota. Use Redis atomic operations for rate limiting. 

### **11.1 Invitation-Based Registration** 

- Extend POST /api/auth/register/ to accept an optional invite_token. 

- When an invitation token is supplied, validate its hash, expiry, acceptance status, and invited email. 

- Create the user and membership in the existing organization; do not create a second organization. 

- Mark the invitation accepted_at after successful registration and perform the operation transactionally. 

- If no invitation token is supplied, create a new organization and owner membership as specified for normal registration. 

### **11.2 API Key Lifecycle and Permission Enforcement** 

- Add PATCH /api/keys/{id}/ for key rename, permission changes, and rate-limit override updates. 

- Add POST /api/keys/{id}/regenerate/ to create a replacement key and revoke the old key. 

- Enforce read, write, and admin permissions server-side for every API-key-authenticated endpoint. 

- Default newly created keys to write permission unless the caller selects another permitted level. 

- Return the complete regenerated key only once; thereafter expose only its prefix. 

### **11.3 AI Query History Persistence** 

- Create an AIQuery/QueryHistory model containing organization_id, user_id, api_key_id, query_text, response_text, model_used, token counts, latency, estimated_cost, cache_hit, and created_at. 

- Keep UsageLog as the billing/audit source of truth and use AIQuery for user-facing history. 

- Add GET /api/ai/history/ with pagination and sorting by date, cost, or model. 

- Return the latest 10 queries by default for the AI Query screen. 

### **11.4 Atomic Monthly Quota Enforcement** 

- Reserve monthly request quota before invoking an LLM, using a transaction and row-level locking or an equivalent atomic mechanism. 

- Reject a request when the organization has reached its plan limit, preventing concurrent requests from exceeding the quota. 

- Finalize token, latency, model, cost, and cache fields after processing without double-counting the reserved request. 

- Enterprise remains unlimited for requests but continues to track usage and cost. 

### **11.5 Organization Lifecycle and Membership Management** 

- Add PATCH /api/org/members/{id}/ for role changes and DELETE /api/org/members/{id}/ for individual member removal. 

- Add POST /api/org/transfer-ownership/ and enforce that the target belongs to the same organization. 

- Add DELETE /api/org/ for owner-only organization deletion; use soft deletion through is_active=False initially. 

- Prevent admins from removing or transferring the owner and prevent members/viewers from managing membership. 

- Add transactional safeguards for role changes, ownership transfer, and organization deactivation. 

### **11.6 Billing, Budget, and Cost Projection** 

- Add monthly_budget and budget_alert_threshold fields to Organization, with sensible defaults. 

- Expose budget remaining, projected monthly spend, current usage, and estimated cost through the billing usage endpoint. 

- Implement mock upgrade/downgrade behavior that updates the organization's selected plan and applies the new limits. 

- Calculate admin revenue estimate as the sum of active organizations' plan prices. 

- Keep all model pricing in ModelConfig and calculate request cost from actual input and output token counts. 

### **11.7 Cache Administration and Metrics** 

- Expose cache_entry_count and, where practical, cache memory size in cache statistics. 

- Add an admin configuration endpoint for viewing and updating the semantic similarity threshold. 

- Use a global default threshold of 0.95 and allow an organization-level override only for authorized owners/admins if this behavior is enabled. 

- Ensure cache clear, threshold changes, and cache statistics are organization-scoped unless performed by a superadmin. 

- Optionally use a short-lived Redis lock to reduce duplicate LLM calls when identical cache misses arrive concurrently. 

### **11.8 Admin Provider Health and Platform Metrics** 

- GET /api/admin/health/ must check PostgreSQL, Redis, Gemini, and OpenAI provider availability, including latency where available. 

- GET /api/admin/usage/ must expose total organizations, users, requests today/month, revenue estimate, cache hit rate, and platform cost. 

- The admin tenant table must include plan, member count, monthly requests, monthly cost, and active/suspended status. 

- Editable model routing configuration must validate that selected models are active and permitted for the target plan. 

### **11.9 API Documentation and Usage Export** 

- Add DRF Swagger/ReDoc documentation using drf-spectacular or an equivalent OpenAPI generator. 

- Expose /api/docs/, /api/schema/, and /api/redoc/ as appropriate. 

- Add GET /api/billing/usage/export/ for organization-scoped CSV export of daily/monthly usage. 

- Restrict exports to authorized organization members and never include another organization's data. 

### **11.10 Request IDs and Standardized Errors** 

- Add RequestIDMiddleware to generate or propagate a UUID per request and return it in X-Request-ID. 

- Persist request_id in UsageLog/audit records and include it in provider failure and quota error responses. 

- Use a consistent JSON error shape with stable codes such as AUTHENTICATION_FAILED, PERMISSION_DENIED, MONTHLY_LIMIT_EXCEEDED, RATE_LIMIT_EXCEEDED, INVALID_API_KEY, MODEL_UNAVAILABLE, and VALIDATION_ERROR. 

- Never log passwords, full API keys, provider secrets, or sensitive prompt data beyond the intended query-history requirements. 

### **11.11 Frontend Corrections and UX States** 

- Use React Router with Vite for client-side routing; use route guard components to protect authenticated routes (no Next.jsstyle server middleware). 

- Implement the login Remember me checkbox according to the selected cookie/session persistence strategy. 

- Implement password reset as a multi-step flow: email, console-provided token/code, new password, and confirmation. 

- Add AI query states for idle, loading, success, cache hit, rate limited, monthly quota exceeded, provider failure, and retry. 

- Display quota warnings at 80%, quota blocking at 100%, request IDs for support/debugging, and fallback/model metadata when applicable. 

- Add pagination or bounded loading for members, API keys, tenants, usage history, and query history. 

### **11.12 Final Acceptance Additions** 

- An invited user joins the inviter's organization and cannot accidentally create a duplicate organization. 

- API-key read/write/admin permissions are enforced by backend tests. 

- Two concurrent requests cannot exceed a Free or Pro monthly quota. 

- Query history displays the latest 10 queries with responses and sorting. 

- Ownership transfer, member role changes, member removal, and organization deletion obey role rules. 

- Admin health reports database, Redis, and each configured LLM provider. 

- CSV export and OpenAPI documentation are accessible only through authorized routes. 

## **12. Backend Reliability & Failure-Mode Analysis** 

This section identifies overload, starvation, and timeout risks in the architecture above, and specifies the fixes required for the three highest-priority issues before submission. 

#### **Fix #1 — Atomic rate limiter (Lua script)** 

Replace the three separate Redis calls (ZADD / ZREMRANGEBYSCORE / ZCARD) with a single Lua script executed via EVAL, so the check-and-increment happens as one atomic operation on the Redis server. This removes the race window between concurrent requests from the same org. The script also returns the window's reset time (needed for the X-RateLimit-Reset header required by §5), and the caller resolves the effective limit — org plan limit, or the API key's rate_limit_override if the request is authenticated via a key — before invoking the script, so per-key overrides (§5) still appl 

#### **Fix #2 — Non-blocking semantic-cache embedding** 

Run the embedding call under an async view via asyncio.to_thread, bounded by a short timeout (e.g. 2s). On timeout, treat it as a cache miss and fall through to the LLM call rather than blocking the request — a slow embed should degrade gracefully, never hang the worker. **Infra note:** this requires the ai_service query view (and the rate-limit / 

org-context middleware in its path) to run under an ASGI server (uvicorn/daphne) rather than plain WSGI+gunicorn. Auth, org, and billing views can remain sync DRF — Django supports mixing sync and async views — but the Dockerfile's CMD and requirements.txt need to reflect ASGI for this endpoint specifically. 

#### **Fix #3 — Circuit breaker layered on top of the documented 10s timeout** 

§6 specifies a 10s per-model timeout before falling back — that value is kept as-is so the fix does not contradict the written spec. The circuit breaker is added as an additional layer: a model that has failed N times within a rolling window is skipped on the _next_ request without paying its timeout again, but a model in a fresh/closed state still gets its full documented 10s before falling back. This bounds worst-case latency for repeated failures while leaving first-attempt behavior unchanged. Per §6 ("Log all fallback events"), both timeout-triggered fallbacks and breaker-triggered skips are logged, tagged by type, so the audit trail stays complete. 

|-- backend/
| |-- manage.py
| |-- config/
| | |-- settings.py # Django + JWT + Redis + PG config
| | |-- urls.py
| |-- accounts/ # Auth & org management app
| | |-- models.py # User, Organization, Membership, Invite
| | |-- serializers.py
| | |-- views.py # Auth + org ViewSets
| | |-- urls.py
| | |-- admin.py
| |-- billing/ # Plans, usage, API keys app
| | |-- models.py # Plan, APIKey, UsageLog, Invoice
| | |-- serializers.py
| | |-- views.py # Billing + key ViewSets
| | |-- urls.py
| | |-- admin.py
| |-- ai_service/ # Core AI feature app
| | |-- models.py # CacheEntry, ModelConfig
| | |-- views.py # AI query endpoint
| | |-- services/
| | | |-- model_router.py # Route to LLM by plan tier
| | | |-- semantic_cache.py # Embed, search, cache logic
| | | |-- llm_client.py # Multi-provider LLM calls
| | | |-- usage_tracker.py # Log every request + cost
| |-- middleware/
| | |-- rate_limiter.py # Redis sliding window
| | |-- api_key_auth.py # API key authentication
| | |-- org_context.py # Inject org into request
| | |-- usage_limit.py # Monthly limit enforcement
| |-- management/commands/
| | |-- seed_demo.py # Create demo admin + org + plans
| |-- requirements.txt
| |-- Dockerfile