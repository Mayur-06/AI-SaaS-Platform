# RAG Pipeline Integration Plan

## Existing Inventory (`rag/` and `memory/`)

Reusable as-is or with minor config changes:
- `rag/textchunker.py` — `TextChunker` (langchain `RecursiveCharacterTextSplitter`)
- `rag/embedder.py` — `Embedder` (sentence-transformers, change default model to `all-MiniLM-L6-v2`)
- `rag/document_loader.py` — `DocumentLoader` (PDF/TXT/CSV/DOCX extraction + cleaning)
- `rag/providers/{base,gemini,openai,groq,claude}.py` — LLM provider implementations (normalize interface: add `temperature` to `BaseLLM.generate()`, handle `max_tokens` in `ClaudeProvider`)

Must be adapted:
- `rag/pipeline.py` — `RAGPipeline.ask()` returns only `answer` string, takes `user_memories`, no org scoping, no metadata
- `rag/supabase_document_store.py` — tied to Supabase client and `user_id`; must become Django ORM + pgvector with `organization_id`

Do not reuse:
- `rag/faiss_manager.py` — entirely commented out
- `rag/lang_workflow.py` — entirely commented out
- `memory/graph.py` — separate memory-evaluation system, out of scope for SaaS plan

## Strategy: Adapter Layer in `ai_service/`

Keep `rag/` as a standalone pure-Python library. Build a Django adapter layer in `ai_service/services/` that instantiates the pipeline with Django-backed components and adds SaaS concerns (quota, rate-limit, semantic cache, usage logging).

### New Files to Create

**`ai_service/models.py`**
- `Document` — `organization` (FK), `filename`, `status`, `uploaded_by` (FK), `created_at`
- `DocumentChunk` — `document` (FK), `organization` (FK, denormalized), `chunk_text`, `embedding_vector` (pgvector `VectorField(dimensions=384)`), `chunk_index`, `created_at`
- Indexes: `organization_id`, `document_id`, `embedding_vector`

**`ai_service/services/document_store.py`**
- `DjangoDocumentStore` — implements same interface as `SupabaseDocumentStore`: `search(query_embedding, top_k)`, `add_document(doc_id, chunks)`, `delete_document(document_name)`, `list_documents()`
- Uses Django ORM + pgvector distance lookup
- Every query filters by `organization_id`
- `search()` returns dicts with `chunk_id`, `score`, `doc_id`, `text`

**`ai_service/services/model_router.py`**
- `ModelRouter` — replaces `rag/generator.py`'s hardcoded Gemini
- Reads `ModelConfig` and `RoutingRule` from DB
- Selects primary model by plan, falls back on failure
- Uses existing provider classes via a unified wrapper
- Returns metadata: `provider`, `model`, `latency_ms`, `input_tokens`, `output_tokens`, `estimated_cost`, `attempts`

**`ai_service/services/rag_orchestrator.py`**
- `RAGOrchestrator` — orchestrates a single AI query for an organization
- Internally instantiates `RAGPipeline` from `rag/pipeline.py` with:
  - `Embedder()` from `rag/embedder.py` (model `all-MiniLM-L6-v2`)
  - `DjangoDocumentStore(organization, embedder)`
  - `ModelRouter(organization)`
  - `TextChunker()` from `rag/textchunker.py`
- Flow per query:
  1. Semantic cache lookup
  2. If miss: monthly quota check → rate limit → `RAGPipeline.ask()` → calculate cost → log `UsageLog` → update `UsageAggregate` → store in semantic cache
  3. Return dict: `answer`, `model`, `provider`, `input_tokens`, `output_tokens`, `latency_ms`, `estimated_cost`, `cache_hit`, `request_id`

**`ai_service/services/chunking.py`**
- Thin wrapper around `rag/textchunker.py` for Django file handling
- Accepts file bytes, delegates to `DocumentLoader` for text extraction, then `TextChunker` for splitting
- Returns list of chunk strings

### Modified Existing Files

**`rag/embedder.py`**
- Change default `model_name` from `"BAAI/bge-small-en-v1.5"` to `"sentence-transformers/all-MiniLM-L6-v2"` to match plan §4

**`rag/pipeline.py`**
- Rename constructor param `faiss_manager` → `document_store` (keep backward compat if needed)
- Change `ask(self, question, user_memories=None)` → `ask(self, question, organization_id=None)`
  - Remove memory-block injection from system prompt (memory feature is out of scope)
- Change return from `str` → `dict`: `{"answer": str, "model": str, "provider": str, "latency_ms": int, "input_tokens": int, "output_tokens": int}`

**`rag/providers/base.py`**
- Add `temperature: float = 0.2` parameter to `generate()` to normalize interface

**`rag/providers/claude.py`**
- Add `max_tokens: int = 4096` parameter to `generate()` (currently hardcoded)

### Phase 1 Dependencies (Created in Parallel with RAG Integration)

These are Phase 1 deliverables per the Final Plan and must be built alongside the RAG adapter layer:

- **Semantic cache service** — depends on Redis; Phase 1 deliverable per Final Plan §4
- **Model router routing rules** (`ModelConfig`, `RoutingRule` models) — Phase 1 deliverable per Final Plan §3, §6
- **Usage logging** (`UsageLog`, `UsageAggregate` models) — Phase 1 deliverable per Final Plan §3, §7
- **Quota enforcement** — Phase 1 deliverable per Final Plan §2.3, §7, §11.4
- **Rate limiting** — Phase 1 deliverable per Final Plan §5
- **API endpoints** — Phase 1 deliverable per Final Plan §8

## Execution Order

1. **Models (Phase 1, parallel)**: Create `Document`, `DocumentChunk`, `ModelConfig`, `RoutingRule`, `UsageLog`, `UsageAggregate`, and `CacheEntry` Django models + migrations
2. **Semantic cache service (Phase 1, parallel)**: Build Redis-backed semantic cache with org-namespaced keys per Final Plan §4
3. **Rate limiting (Phase 1, parallel)**: Implement Redis sliding-window rate limiter with Lua atomicity per Final Plan §5, §12 Fix #1
4. **Quota enforcement (Phase 1, parallel)**: Implement atomic monthly quota check per Final Plan §11.4
5. **Document store**: Build `DjangoDocumentStore` with pgvector search, verify interface compatibility with `SupabaseDocumentStore`
6. **Provider normalization**: Fix `BaseLLM` interface + `ClaudeProvider` max_tokens
7. **Pipeline adaptation**: Patch `rag/pipeline.py` constructor + `ask()` signature and return type
8. **Model router**: Build `ModelRouter` wrapping existing provider classes; reads `ModelConfig` and `RoutingRule` from DB
9. **Chunking wrapper**: Build `chunking.py` for Django file ingestion
10. **Orchestrator**: Build `RAGOrchestrator` tying quota → rate-limit → cache → RAG → logging together
11. **Validate**: Unit test `DjangoDocumentStore.search()` returns org-scoped results; test `RAGOrchestrator.query()` returns expected metadata dict; verify two orgs cannot see each other's chunks

## Risks & Validation

- **Risk**: Existing `rag/pipeline.py` imports use `app.rag.*` paths that don't exist in Django project. Fix: change imports to relative or absolute package imports.
- **Risk**: `sentence-transformers` model loading is slow. Mitigation: load once at process startup in ASGI lifespan.
- **Risk**: pgvector distance ordering differs from Supabase similarity ordering. Validate: `l2_distance` (lower=better) vs `similarity` (higher=better). `DjangoDocumentStore` must normalize scores.
- **Risk**: `rag/providers/` use per-call API keys from env vars; plan requires provider keys in Django settings. Mitigation: `ModelRouter` reads keys from settings, injects into providers at call time.
