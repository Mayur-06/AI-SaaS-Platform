"""
AI SaaS Platform — Official External Developer Python SDK Client Example
========================================================================

This script demonstrates how an external client application can access all
capabilities of the AI SaaS Platform using an API key:
- RAG Queries with Citations & Token Analytics
- Document Ingestion & Vector Indexing
- Knowledge Base Management (List & Delete)
- Metered Usage & FinOps Attribution Tracking

Installation:
    pip install requests
"""

import os
import sys
import time
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List

# Ensure Unicode characters print cleanly across all terminal environments (especially Windows cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")



class AISaaSClient:
    """
    Client for interacting with the AI SaaS Platform API via API key authentication.
    """

    def __init__(self, api_key: str, base_url: str = "http://116.202.210.102:20358/api"):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        # Supports standard Authorization Bearer header or X-API-Key header
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        })

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """
        Parses response with special handling for rate limits and permission errors.
        """
        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "60")
            rem_rpm = response.headers.get("X-RateLimit-Remaining", "0")
            rem_tpm = response.headers.get("X-RateLimit-Remaining-Tokens", "0")
            print(f"\n[429 Rate Limit Exceeded] Retry-After: {retry_after}s | RPM Remaining: {rem_rpm} | TPM Remaining: {rem_tpm}")
            try:
                error_data = response.json()
                print(f"Details: {error_data.get('error', {}).get('message', response.text)}")
            except Exception:
                print(f"Details: {response.text}")
            response.raise_for_status()

        if response.status_code == 403:
            print(f"\n[403 Permission Denied] The provided API key does not have the required scope.")
            try:
                print(f"Details: {response.json()}")
            except Exception:
                print(f"Details: {response.text}")
            response.raise_for_status()

        if not response.ok:
            print(f"\n[Error {response.status_code}] {response.text}")
            response.raise_for_status()

        return response.json()

    # =========================================================================
    # 1. RAG Core AI Operations (Requires scope: 'rag:query' or 'write' or 'admin:*')
    # =========================================================================
    def query(
        self,
        question: str,
        model: str = "gemini-2.5-flash",
        top_k: int = 8,
        document_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a RAG question answering query against the tenant's vector database.
        
        Args:
            question: The user prompt or inquiry.
            model: Target model ('gemini-2.5-flash', 'gemini-2.5-pro', or 'auto').
            top_k: Number of semantic passages to retrieve and synthesize.
            document_id: Optional document UUID to restrict search to a single document.
        """
        url = f"{self.base_url}/ai/query/"
        payload = {
            "question": question,
            "model": model,
            "top_k": top_k,
        }
        if document_id:
            payload["document_id"] = document_id

        response = self.session.post(url, json=payload)
        data = self._handle_response(response)

        print("\n=================== RAG ANSWER ===================")
        print(data.get("answer", ""))
        print("\n================ CITED PASSAGES =================")
        for chunk in data.get("cited_chunks", []):
            title = chunk.get("document_title", "Document")
            sec = chunk.get("chunk_index", 0) + 1
            score = chunk.get("score", 0.0)
            print(f"- {title} (Section {sec}) [Relevance: {score}]")

        tokens = data.get("tokens", {})
        print(f"\nModel: {data.get('model_used')} | Tokens: {tokens.get('total_tokens', 0)} (Prompt: {tokens.get('prompt_tokens', 0)}, Output: {tokens.get('completion_tokens', 0)}) | Latency: {data.get('latency_ms')}ms")
        return data

    # =========================================================================
    # 2. Document Upload & Indexing (Requires scope: 'documents:write' or 'write' or 'admin:*')
    # =========================================================================
    def upload_document(self, file_path: str, title: Optional[str] = None) -> Dict[str, Any]:
        """
        Uploads a PDF, DOCX, TXT, or Markdown document.
        Automatically chunks text and computes vector embeddings for RAG search.
        """
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        url = f"{self.base_url}/ai/documents/"
        with open(path, "rb") as f:
            files = {"file": (path.name, f, "application/octet-stream")}
            data = {"title": title or path.name}
            # Remove application/json header for multipart/form-data upload
            headers = {"Authorization": f"Bearer {self.api_key}"}
            response = requests.post(url, files=files, data=data, headers=headers)

        doc = self._handle_response(response)
        print(f"\n[Uploaded] Doc ID: {doc.get('id')} | Title: {doc.get('title')} | Status: {doc.get('status')} | Chunks: {doc.get('chunk_count', 0)}")
        return doc

    # =========================================================================
    # 3. Knowledge Base Management (Requires scope: 'documents:read' or 'write' or 'admin:*')
    # =========================================================================
    def list_documents(self) -> List[Dict[str, Any]]:
        """
        List all indexed documents in the tenant's knowledge base.
        """
        url = f"{self.base_url}/ai/documents/"
        response = self.session.get(url)
        data = self._handle_response(response)
        documents = data.get("results", data) if isinstance(data, dict) else data

        print(f"\n================ KNOWLEDGE BASE ({len(documents)} docs) ================")
        for d in documents:
            status_tag = d.get("status", "unknown").upper()
            print(f"- [{status_tag}] {d.get('title')} (ID: {d.get('id')}) | Chunks: {d.get('chunk_count', 0)}")
        return documents

    def delete_document(self, document_id: str) -> None:
        """
        Deletes a document and clears all of its vector chunk embeddings.
        Requires scope: 'documents:write' or 'admin:*'.
        """
        url = f"{self.base_url}/ai/documents/{document_id}/"
        response = self.session.delete(url)
        if response.status_code in [200, 204]:
            print(f"\n[Deleted] Document {document_id} removed from vector database.")
        else:
            self._handle_response(response)

    # =========================================================================
    # 4. Usage Tracking & FinOps Attribution (Requires scope: 'admin:*')
    # =========================================================================
    def get_usage_summary(self) -> Dict[str, Any]:
        """
        Retrieves metered usage breakdown including monthly quota, token consumption,
        estimated cost, and per-API-key attribution.
        """
        url = f"{self.base_url}/billing/usage/"
        response = self.session.get(url)
        usage = self._handle_response(response)

        print("\n================ METERED USAGE & ATTRIBUTION ================")
        print(f"Requests: {usage.get('requests_used', 0)} / {usage.get('monthly_limit', 0)} ({usage.get('usage_percent', 0)}%)")
        print(f"Tokens:   Input: {usage.get('input_tokens', 0):,} | Output: {usage.get('output_tokens', 0):,}")
        print(f"Spend:    ${usage.get('total_cost', 0):.4f} (Budget Remaining: ${usage.get('budget_remaining', 0):.2f})")
        print(f"Cache:    {usage.get('cache_hits', 0)} hits ({usage.get('cache_hit_rate', 0)}%) | Saved: ${usage.get('cache_savings', 0):.4f}")

        by_key = usage.get("by_api_key", [])
        if by_key:
            print("\n--- Attribution by API Key ---")
            for k in by_key:
                print(f"- Key: {k.get('name')} ({k.get('key_prefix')}...) | Requests: {k.get('requests')} | Tokens: {k.get('total_tokens', 0):,} | Cost: ${k.get('total_cost', 0):.4f}")
        return usage

    def export_usage_csv(self, output_file: str = "metered_usage.csv") -> str:
        """
        Downloads the full itemized metered billing log with API key attribution as CSV.
        """
        url = f"{self.base_url}/billing/export/?format=csv"
        response = self.session.get(url)
        if response.ok:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(response.text)
            print(f"\n[Exported] Metered usage log saved to {output_file}")
            return output_file
        else:
            self._handle_response(response)
            return ""


# =============================================================================
# Quickstart Usage Demonstration
# =============================================================================
if __name__ == "__main__":
    # Replace with your actual API key generated in the dashboard
    API_KEY = os.getenv("AI_SAAS_API_KEY", "enter your api key")
    BASE_URL = os.getenv("AI_SAAS_BASE_URL", "http://116.202.210.102:20358/api")

    client = AISaaSClient(api_key=API_KEY, base_url=BASE_URL)

    print("AI SaaS Platform — Python Developer SDK Client")
    print(f"Target: {BASE_URL}")

    # Example 1: Upload a document (PDF, DOCX, TXT, Markdown)
    # client.upload_document(
    #     file_path="sample_docs/guide.pdf",
    #     title="Enterprise Architecture Guide"
    # )

    # Example 2: List documents
    client.list_documents()

    # Example 3: Query the RAG Pipeline
    client.query("What methods and protocols were used to differentiate hiPSCs into muscle progenitor cells?")

    # Example 4: Check metered usage attribution
    # client.get_usage_summary()
