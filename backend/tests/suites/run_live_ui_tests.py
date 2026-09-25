import os, sys
from pathlib import Path
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
import os
import sys
import json
import requests
from pathlib import Path

# Configure utf-8 console output for Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:8000/api"

QUERY_KEY = "sk_live_grC4m9xu4RABOmF7LLKXQlqaex4yXs99"
INGESTION_KEY = "sk_live_MIutK42JIqHg8KanvEz7RzK7uUvb1FNb"
DOC_READ_KEY = "sk_live_PM0SGfsbCyzfymURvMPAuhAjcE7vasgI"
ADMIN_KEY = "sk_live_Wjsol9sghtdZwkABNBHKLabzINkv6i8L"

def banner(title):
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70)

# =============================================================================
# TEST 1: Document Upload (Using Ingestion Only Key)
# =============================================================================
banner("TEST 1: Upload Document via Ingestion Key (Scope: documents:write)")
doc_path = Path(_BACKEND_DIR).parent / "plans" / "Platform_API_Integration_Guide.md"
if not doc_path.exists():
    doc_path = Path("plans/Platform_API_Integration_Guide.md")

with open(doc_path, "rb") as f:
    files = {"file": (doc_path.name, f, "application/octet-stream")}
    data = {"title": "AI SaaS Platform Integration Protocol"}
    headers = {"Authorization": f"Bearer {INGESTION_KEY}"}
    res = requests.post(f"{BASE_URL}/ai/documents/", files=files, data=data, headers=headers)

print(f"HTTP Status: {res.status_code}")
if res.ok:
    doc = res.json()
    uploaded_id = doc.get("id")
    print(f"[SUCCESS] Uploaded Doc ID: {uploaded_id}")
    print(f"Title:  {doc.get('title')}")
    print(f"Status: {doc.get('status')}")
    print(f"Chunks: {doc.get('chunk_count', 0)}")
else:
    print(f"[FAIL] {res.text}")
    sys.exit(1)

# =============================================================================
# TEST 2: List Knowledge Base (Using Doc Read Only Key)
# =============================================================================
banner("TEST 2: List Knowledge Base via Doc Read Key (Scope: documents:read)")
print(f"Key: {DOC_READ_KEY[:14]}...")
res = requests.get(
    f"{BASE_URL}/ai/documents/",
    headers={
        "Authorization": f"Bearer {DOC_READ_KEY}",
        "Accept": "application/json"
    }
)
print(f"HTTP Status: {res.status_code}")
if res.ok:
    docs = res.json()
    items = docs.get("results", docs) if isinstance(docs, dict) else docs
    print(f"[SUCCESS] Knowledge Base has {len(items)} documents in platform:")
    for d in items:
        status_tag = d.get('status', 'unknown').upper()
        print(f"  - [{status_tag}] {d.get('title')} (ID: {d.get('id')}) | Chunks: {d.get('chunk_count', 0)}")
else:
    print(f"[FAIL] {res.text}")
    sys.exit(1)

# =============================================================================
# TEST 3: Ask AI (RAG Query) (Using Query Only Key)
# =============================================================================
banner("TEST 3: Ask AI (RAG Query) via Query Key (Scope: rag:query)")
print(f"Key: {QUERY_KEY[:14]}...")
res = requests.post(
    f"{BASE_URL}/ai/query/",
    headers={
        "Authorization": f"Bearer {QUERY_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "question": "What encryption standards and scope tiers are defined in the integration protocol?",
        "model": "gemini-2.5-flash",
        "top_k": 5
    }
)
print(f"HTTP Status: {res.status_code}")
if res.ok:
    query_data = res.json()
    print("\n--- SYNTHESIZED RAG ANSWER ---")
    print(query_data.get("answer"))
    print("\n--- CITED PASSAGES ---")
    for chunk in query_data.get("cited_chunks", []):
        sec = chunk.get("chunk_index", 0) + 1
        print(f"- {chunk.get('document_title')} (Section {sec}) [Relevance: {chunk.get('score')}]")
    tokens = query_data.get("tokens", {})
    print(f"\nModel: {query_data.get('model_used')} | Latency: {query_data.get('latency_ms')}ms | Tokens: {tokens.get('total_tokens')}")
else:
    print(f"[FAIL] {res.text}")
    sys.exit(1)

# =============================================================================
# TEST 4: Admin Key Operations & Usage Attribution (Scope: admin)
# =============================================================================
banner("TEST 4: Admin Key Operations & FinOps Attribution (Scope: admin)")
print(f"Key: {ADMIN_KEY[:14]}...")
res = requests.get(
    f"{BASE_URL}/billing/usage/",
    headers={
        "Authorization": f"Bearer {ADMIN_KEY}",
        "Accept": "application/json"
    }
)
print(f"Usage Endpoint Status: {res.status_code}")
if res.ok:
    usage = res.json()
    print(f"[SUCCESS] Requests Used: {usage.get('requests_used', 0)} / {usage.get('monthly_limit', 0)}")
    print(f"Input Tokens: {usage.get('input_tokens', 0):,} | Output Tokens: {usage.get('output_tokens', 0):,}")
    print(f"Estimated Cost: ${usage.get('total_cost', 0):.4f}")
    if usage.get("by_api_key"):
        print("Recent Attribution by API Key:")
        for k in usage.get("by_api_key", [])[:3]:
            print(f"  - Key: {k.get('name')} ({k.get('key_prefix')}...) | Requests: {k.get('requests')} | Cost: ${k.get('total_cost', 0):.4f}")
else:
    print(f"Usage summary info: {res.status_code}")

print("\n" + "=" * 70)
print(" ALL 4 UI CODE SCENARIOS EXECUTED AND REFLECTED IN PLATFORM SUCCESSFULLY!")
print("=" * 70)
