# **Phased Implementation Plan** 

### AI SaaS Platform with Multi-Tenancy 

This plan sequences the full Implementation Plan into three phases. Phase 1 delivers every backend capability and every API endpoint before any UI work starts. Phase 2 builds every frontend screen against that complete, working API. Phase 3 closes the loop with integration testing, acceptance verification, and deployment checks. A section-bysection coverage map is included at the end to confirm nothing from the original plan is left out. 

## Phase 1 — Backend Foundation & Complete API Surface 

**_Goal:_** _by the end of this phase, every backend capability and every route in the API Endpoint Plan exists, is authenticated, tenant-isolated, rate-limited, quota-enforced, logged, and hardened per the reliability fixes. Nothing frontend-facing is needed yet, because there is no working API to build a UI against until this phase is done._ 

#### 1.1 Environment & Project Scaffolding 

- Set up Docker Compose with web, db, and redis services (Ref: §1). 

- Initialize the Django 4.2+ project with Django REST Framework, SimpleJWT, and django-cors-headers (Ref: §1). 

- Create the five Django apps: accounts, billing, ai_service, middleware, common/core (Ref: §2.1). 

- Enable the pgvector extension on PostgreSQL — no additional Docker service required (Ref: §3). 

#### 1.2 Data Layer — All Models & Constraints 

- Create all core models: User, Organization, Membership, Invitation, Plan, APIKey, ModelConfig, RoutingRule, UsageLog, UsageAggregate, CacheEntry, Document, DocumentChunk, Invoice (Ref: §3). 

- Create the AIQuery/QueryHistory model for user-facing history, kept separate from UsageLog (Ref: §11.3). 

- Add indexes on organization_id, timestamp, month, api_key_id, and status fields; add unique constraints for org slug, one active membership per user, and active key prefix (Ref: §3). 

- Wrap registration, key creation, plan changes, and usage-aggregation updates in database transactions (Ref: §3). 

#### 1.3 Authentication, Roles & Multi-Tenancy 

- Build POST /api/auth/register/, /login/, /refresh/, /password-reset/, /password-reset/confirm/ and GET /api/auth/verify/{token}/ (Ref: §2.2, §8). 

- Issue 15-minute access and 7-day refresh JWTs carrying user_id, org_id, and role; rotate and blacklist refresh tokens (Ref: §2.2). 

- Extend registration to accept an optional invite_token: validate its hash, expiry, and invited email, then create the user and membership inside the existing organization instead of a new one, marking the invitation accepted transactionally (Ref: §11.1). 

- Implement owner/admin/member/viewer permissions as DRF permission classes enforced strictly serverside (Ref: §2.2). 

- Build OrgScopedQuerySet/OrgScopedManager, organization-context middleware, and per-ViewSet queryset scoping and ownership validation (Ref: §2.3). 

- Add automated cross-tenant isolation tests confirming Org A and Org B cannot read, modify, or clear each other's data (Ref: §2.3). 

- Build GET/PUT /api/org/, GET/POST/DELETE /api/org/members/, and POST /api/org/invite/ (Ref: §8). 

#### 1.4 API Key Management 

- Generate cryptographically secure sk_live_-prefixed keys; store only a bcrypt hash and 12-character prefix; return the full key once, at creation (Ref: §2.4). 

- Build GET/POST /api/keys/, DELETE /api/keys/{id}/, PATCH /api/keys/{id}/ (rename, permission changes, rate-limit override), and POST /api/keys/{id}/regenerate/ (Ref: §2.4, §8, §11.2). 

- Authenticate Bearer API keys through a dedicated authentication class using constant-time comparison; never log full keys; enforce read/write/admin levels server-side on every key-authenticated endpoint, defaulting new keys to write permission (Ref: §2.4, §11.2). 

#### 1.5 Semantic Cache & RAG Retrieval 

- Build the org-scoped document ingestion, chunking, embedding, and retrieval pipeline (adapted from the prior assignment), stored in PostgreSQL via pgvector and isolated by organization_id (Ref: §3). 

- Build the semantic cache: embed queries with all-MiniLM-L6-v2, compare via cosine similarity, store in Redis namespaced by org, use a 0.95 default hit threshold, and apply plan-based TTLs — Free 1 hour, Pro 24 hours, Enterprise 7 days (Ref: §4). 

- Start with brute-force embedding comparison, since the assignment expects a small cache; introduce FAISS or a vector index only if cache size makes linear comparison slow (Ref: §4). 

- Add a cache version/model fingerprint so responses are never reused after a prompt or model change (Ref: §4). 

- Build GET /api/cache/stats/, DELETE /api/cache/clear/, and an admin endpoint to view/update the similarity threshold; scope all three to the organization unless called by a superadmin (Ref: §8, §11.7). 

- Expose cache_entry_count and, where practical, memory size in cache stats; add an optional short-lived Redis lock to reduce duplicate LLM calls on concurrent identical cache misses (Ref: §11.7). 

#### 1.6 Rate Limiting 

- Implement the Redis sliding-window limiter keyed by ratelimit:{org_id}:{minute_window}, with a per-key variant when isolation is required, and a 2-minute TTL for cleanup (Ref: §5). 

- Replace the separate ZADD / ZREMRANGEBYSCORE / ZCARD calls with a single atomic Lua script executed via EVAL, removing the race window between concurrent requests; resolve the effective limit — plan limit or API-key override — before invoking the script (Ref: Fix #1, §5). 

- Return X-RateLimit-Limit / Remaining / Reset on normal responses and Retry-After on 429, with a stable RATE_LIMIT_EXCEEDED error code; skip static and non-API routes (Ref: §5). 

#### 1.7 Model Routing & Fallback 

- Store the model-to-plan mapping in ModelConfig and RoutingRule: Free → Gemini Flash, Pro → GPT-4omini, Enterprise → GPT-4 (Ref: §6). 

- Build ordered fallback chains using httpx with connection pooling and a 10-second per-model timeout; retry only transient failures with bounded exponential backoff (Ref: §6). 

- Layer a circuit breaker on top of the documented 10-second timeout: skip a model that has failed N times within a rolling window on the next request without re-paying its timeout, while a fresh/closed model still gets its full 10 seconds; log timeout-triggered and breaker-triggered fallbacks separately (Ref: Fix #3, §6). 

- Return HTTP 503 with a safe message and request ID if every model fails; support Enterprise custom routing with permitted-model validation (Ref: §6). 

#### 1.8 AI Query Orchestration & Endpoints 

- Build POST /api/ai/query/ end to end: authenticate → resolve org/permissions → check active status and monthly quota → apply Redis rate limiting → validate input → attempt cache lookup → on miss, retrieve top-k org-scoped chunks (RAG), build the augmented prompt, run model routing/fallback → calculate cost 

→ persist UsageLog and update aggregates → store the response in cache → return response, model, tokens, latency, cost, cache status, and request ID (Ref: §7). 

- Reserve the monthly quota atomically — a transaction with row-level locking or an equivalent mechanism — before invoking the LLM, and finalize token/latency/cost/cache fields afterward without doublecounting the reservation (Ref: §11.4). 

- Run the embedding call under asyncio.to_thread inside an async view, bounded by a short timeout (e.g. 2s), falling through to the LLM call on timeout rather than blocking; move this endpoint — and the rate-limit / org-context middleware in its path — to an ASGI server (uvicorn/daphne) while other views stay sync DRF, updating the Dockerfile CMD and requirements.txt accordingly (Ref: Fix #2). 

- Build GET/POST /api/ai/documents/ and DELETE /api/ai/documents/{id}/ for org-scoped RAG document management (Ref: §8). 

- Build GET /api/ai/history/ with pagination and sorting by date, cost, or model, returning the latest 10 queries by default; keep UsageLog as the billing/audit source of truth and AIQuery for user-facing history (Ref: §11.3). 

#### 1.9 Billing, Organization Lifecycle & Admin Endpoints 

- Build GET /api/billing/plan/, POST /api/billing/upgrade/, GET /api/billing/usage/, and GET /api/billing/invoices/ (Ref: §8). 

- Add monthly_budget and budget_alert_threshold to Organization; expose budget remaining and projected spend through the usage endpoint; emit X-Usage-Warning at 80% of the monthly limit and block at 100%; keep Enterprise unlimited on requests but still cost-tracked (Ref: §11.6). 

- Implement mock plan upgrade/downgrade that updates the organization's plan and applies the new limits; calculate the admin revenue estimate as the sum of active organizations' plan prices (Ref: §11.6). 

- Build PATCH /api/org/members/{id}/, DELETE /api/org/members/{id}/, POST /api/org/transferownership/, and DELETE /api/org/ (soft delete via is_active=False); enforce that admins cannot remove or transfer the owner and that members/viewers cannot manage membership; wrap role changes, transfers, and deactivation in transactions (Ref: §11.5). 

- Build GET /api/admin/tenants/, GET /api/admin/usage/, and GET /api/admin/health/ (checking PostgreSQL, Redis, Gemini, and OpenAI, with latency where available); protect all three with superadmin permissions; validate that edited routing configuration only selects active, plan-permitted models (Ref: §8, §11.8). 

#### 1.10 Cross-Cutting Backend Concerns 

- Add RequestIDMiddleware to generate or propagate a UUID per request, returned as X-Request-ID and persisted on UsageLog/audit records and error responses (Ref: §11.10). 

- Standardize the JSON error shape with stable codes — AUTHENTICATION_FAILED, PERMISSION_DENIED, MONTHLY_LIMIT_EXCEEDED, RATE_LIMIT_EXCEEDED, INVALID_API_KEY, MODEL_UNAVAILABLE, VALIDATION_ERROR — and never log passwords, full API keys, provider secrets, or sensitive prompt data beyond the intended query-history requirements (Ref: §11.10). 

- Add OpenAPI documentation (drf-spectacular or equivalent) at /api/docs/, /api/schema/, and /api/redoc/ (Ref: §11.9). 

- Build GET /api/billing/usage/export/ for organization-scoped CSV export, restricted to authorized members (Ref: §11.9). 

- Register Organization, Membership, Plan, APIKey, UsageLog, CacheEntry, ModelConfig, RoutingRule, Invitation, UsageAggregate, and Invoice in Django Admin, and protect admin-only endpoints with superadmin permissions (Ref: §11 corrections). 

- Log authentication source, key ID, provider, model, fallback attempts, latency, tokens, cost, cache status, and request ID on every AI call (Ref: §11 corrections). 

- Build GET /api/health/ (Ref: §8). 

**Phase exit criteria:** every route in the API Endpoint Plan (§8) responds correctly and matches its spec; tenant isolation, quota enforcement, rate limiting, model fallback, and the three reliability fixes all hold under concurrent load; Django Admin and OpenAPI docs are live. No screen has been built yet, and none is needed yet. 

## Phase 2 — Frontend: All Screens & UX States 

**_Goal:_** _with a complete and stable API from Phase 1, build the full React (Vite) client against the real endpoints — no mock data, no placeholder screens._ 

#### 2.1 Project Setup & Shared Infrastructure 

- Scaffold the Vite + React Router project with the folder layout: src/pages, src/components, src/services, src/store (Ref: §9.1). 

- Build an Axios instance with access-token injection, refresh-token handling, and centralized 401/429/5xx error handling (Ref: §9). 

- Decide between secure httpOnly cookies and localStorage for the assignment demo, document the tradeoff, and use short-lived access tokens either way (Ref: §9). 

- Build route guards that redirect unauthenticated users to /login, and wire up React Router routes for auth, dashboard, ai, billing, keys, settings, and admin (Ref: §9, §11.11). 

- Set up Zustand stores: authStore, orgStore, billingStore, holding org/user/role/plan/usage data fetched from the backend (Ref: §9, §9.1). 

- Build the shared layout: sidebar after login, top plan badge, organization selector placeholder, and mobile navigation (Ref: §9). 

#### 2.2 Authentication Screens 

- Build centered login, register, and password-reset cards; registration collects email, password, confirmation, and organization name (Ref: §9.2). 

- Implement the Remember Me checkbox per the chosen cookie/session strategy, and a multi-step password reset flow: email, console-provided token, new password, confirmation (Ref: §11.11). 

- Support registration via an invitation token so an invited user joins the existing organization rather than creating a new one (Ref: §11.1). 

#### 2.3 Dashboard Screen 

- Build monthly requests, remaining quota, cache hit rate, estimated cost, a 30-day usage chart, and a quick AI-query widget, verified against the database aggregates (Ref: §9.2). 

#### 2.4 AI Query Screen 

- Build the textarea, send button, response panel with model badge, token counts, latency, cost, cache hit/miss indicator, cited RAG source chunks, a document upload/list panel, and the last 10 queries (Ref: §9.2). 

- Implement every required state — idle, loading, success, cache hit, rate limited, monthly quota exceeded, provider failure, and retry — and display quota warnings at 80%/100%, request IDs, and fallback/model metadata (Ref: §11.11). 

#### 2.5 Billing Screen 

- Build the current plan view, plan comparison cards, usage/cost charts, cache savings, a daily usage table, cost projection, and budget remaining (Ref: §9.2, §11.6). 

#### 2.6 API Keys Screen 

- Build the prefix-only key list, create-key modal, one-time full-key reveal/copy dialog, permission selector, revoke and regenerate actions, and curl/Python usage examples, with bounded loading or pagination on the list (Ref: §9.2, §11.2, §11.11). 

#### 2.7 Organization Settings Screen 

- Build organization data, member list with roles, invitations, ownership transfer, and a danger zone, all enforcing the role rules validated server-side in Phase 1 (Ref: §9.2, §11.5). 

#### 2.8 Admin / Superadmin Screen 

- Build the tenant table (plan, member count, monthly requests/cost, status), platform metrics, health panel, and an editable model-routing configuration with validation feedback (Ref: §9.2, §11.8). 

#### 2.9 Cross-Cutting Frontend Polish 

- Add pagination or bounded loading across members, API keys, tenants, usage history, and query history lists (Ref: §11.11). 

**Phase exit criteria:** all seven required screens are live against the real backend, every AI-query UX state is reachable and demonstrable, and no screen depends on placeholder or mock data. 

## Phase 3 — Integration Testing, Acceptance & Deployment Verification 

**_Goal:_** _close the loop by verifying the full system — backend and frontend together — against every acceptance criterion in the plan._ 

#### 3.1 Tenant Isolation & Security Verification 

- Confirm two organizations cannot access each other's users, queries, usage, API keys, documents, retrieved chunks, or cache entries (Ref: §10). 

- Confirm revoked keys return 401 immediately and full key values are shown only once, stored hashed (Ref: §10). 

#### 3.2 Quota, Rate Limit & Cache Verification 

- Confirm the Free plan blocks the 101st monthly request and returns usage information (Ref: §10). 

- Confirm rate limits trigger at 10/min, 60/min, and 300/min with correct headers (Ref: §10). 

- Confirm two concurrent requests cannot exceed a Free or Pro monthly quota (Ref: §11.12). 

- Confirm repeating an identical or sufficiently similar query produces a cache hit at zero LLM cost, and that cache entries expire per plan TTL without crossing organizations (Ref: §10). 

#### 3.3 Reliability & Fallback Verification 

- Confirm primary-model failure invokes fallback and records the event, with breaker-triggered skips logged separately from timeout-triggered fallbacks (Ref: §10, Fix #3). 

- Confirm admin health reports database, Redis, and each configured LLM provider (Ref: §11.12). 

#### 3.4 Data, Audit & Access Verification 

- Confirm usage logs contain tokens, model, latency, cache flag, and calculated cost, and that dashboard charts match the database aggregates (Ref: §10). 

- Confirm ownership transfer, member role changes, member removal, and organization deletion all obey role rules (Ref: §11.12). 

- Confirm query history displays the latest 10 queries with responses and sorting (Ref: §11.12). 

- Confirm CSV export and OpenAPI documentation are reachable only through authorized routes (Ref: §11.12). 

#### 3.5 Deployment Verification 

- Confirm docker-compose down -v && docker-compose up -d starts a clean, fully working installation (Ref: §10). 

- Confirm Django Admin exposes all required models and that admin-only endpoints are protected (Ref: §10). 

**Phase exit criteria:** every item in the Testing and Acceptance Checklist and the Final Acceptance Additions passes, and the platform starts cleanly from a fresh docker-compose up. This is the last phase before hand-off/submission. 

## Coverage Map — Original Plan Sections to Phases 

This table cross-references every section and subsection of the Implementation Plan (and its Corrections and Reliability appendix) to where it is delivered below, to confirm nothing has been left out. 

|**Plan Section**|**Covers**|**Delivered In**|
|---|---|---|
|§1|System Architecture|Phase 1—1.1|
|§2.1|DjangoApplications|Phase1 — 1.1|
|§2.2|Authentication and Authorization|Phase 1—1.3|
|§2.3|Multi-Tenancy andDataIsolation|Phase1 — 1.3|
|§2.4|API Key Management|Phase 1—1.4|
|§3|DatabaseDesign|Phase1 — 1.2|
|§4|Semantic Cache Implementation|Phase 1—1.5|
|§5|RateLimitingImplementation|Phase1 — 1.6|
|§6|Model Routing and Fallback|Phase 1—1.7|
|§7|AIQuery Orchestration|Phase1 — 1.8|
|§8|API Endpoint Plan|Phase 1—1.3 to 1.10|
|§9 / 9.1/ 9.2|FrontendImplementation Plan|Phase2 — 2.1to2.8|
|§10|Testing and Acceptance Checklist|Phase 3—3.1 to 3.5|
|§11.1|Invitation-BasedRegistration|Phase1 — 1.3;Phase2 — 2.2|
|§11.2|API Key Lifecycle and Permission<br>Enforcement|Phase 1 — 1.4; Phase 2 — 2.6|
|§11.3|AI Query History Persistence|Phase 1—1.8|
|§11.4|AtomicMonthly QuotaEnforcement|Phase1 — 1.8|
|§11.5|Organization Lifecycle and<br>MembershipManagement|Phase 1 — 1.9; Phase 2 — 2.7|
|§11.6|Billing, Budget, and Cost Projection|Phase 1—1.9; Phase 2—2.5|
|§11.7|CacheAdministrationandMetrics|Phase1 — 1.5|
|§11.8|Admin Provider Health and Platform<br>Metrics|Phase 1 — 1.9; Phase 2 — 2.8|
|§11.9|API Documentation and Usage<br>Export|Phase 1 — 1.10|
|§11.10|Request IDs and Standardized Errors|Phase 1—1.10|
|§11.11|Frontend Corrections and UXStates|Phase2 — 2.1,2.4,2.9|
|§11.12|Final Acceptance Additions|Phase 3—3.1 to 3.4|
|§12|Backend Reliability & Failure-Mode<br>Analysis (Fix #1–#3)|Phase 1 — 1.6, 1.7, 1.8|



