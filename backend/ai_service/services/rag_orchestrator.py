import logging
import time
import asyncio
from typing import Optional, Dict, Any, List
from accounts.models import Organization, User
from billing.models import APIKey
from ai_service.models import Document, DocumentChunk, AIQuery
from ai_service.services.document_store import DjangoDocumentStore
from ai_service.services.model_router import ModelRouter
from ai_service.services.semantic_cache import SemanticCache
from ai_service.services.llm_client import LLMClient
from ai_service.services.usage_tracker import log_usage
from ai_service.services.chunking import extract_and_chunk
from rag.embedder import Embedder
from rag.textchunker import TextChunker
from rag.pipeline import RAGPipeline
from django.conf import settings

logger = logging.getLogger(__name__)


class RAGOrchestrator:
    def __init__(self, organization: Organization, user: Optional[User] = None, api_key: Optional[APIKey] = None):
        self.organization = organization
        self.user = user
        self.api_key = api_key
        self.embedder = Embedder()
        self.document_store = DjangoDocumentStore(organization, self.embedder)
        self.model_router = ModelRouter(organization)
        self.semantic_cache = SemanticCache(organization)
        self.text_chunker = TextChunker()

    def _build_prompt(self, question: str, chunks: List[Dict]) -> tuple:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            doc_name = chunk.get("doc_id", "unknown")
            context_parts.append(f"[Document {i}] (doc_id={doc_name})\n{chunk['text']}")
        context = "\n\n".join(context_parts) if context_parts else "No relevant documents found."

        system_prompt = """You are a helpful and conversational AI assistant with access to uploaded documents.

Use the document context when relevant to answer the user's question accurately.
If the information is not in the documents, say so clearly.
Be concise and helpful."""

        user_prompt = f"""Context from uploaded documents:
{context}

Question: {question}"""
        return system_prompt, user_prompt

    def _run_query_async(self, question: str) -> Dict[str, Any]:
        try:
            query_embedding = self.embedder.encode(question)
        except Exception as exc:
            logger.warning("Embedding failed, proceeding without cache lookup: %s", exc)
            query_embedding = None

        request_id = str(__import__("uuid").uuid4())

        if query_embedding is not None:
            cache_result = self.semantic_cache.lookup(query_embedding, question)
            if cache_result:
                log_usage(
                    organization=self.organization,
                    endpoint="/api/ai/query/",
                    model_used=cache_result.get("model", "cached"),
                    cache_hit=True,
                    request_id=request_id,
                    user=self.user,
                    api_key=self.api_key,
                )
                return {
                    "answer": cache_result["answer"],
                    "model": cache_result.get("model"),
                    "provider": "cache",
                    "input_tokens": 0,
                    "output_tokens": len(cache_result["answer"].split()),
                    "latency_ms": 0,
                    "estimated_cost": 0,
                    "cache_hit": True,
                    "request_id": request_id,
                }

        chunks = self.document_store.search(query_embedding if query_embedding is not None else self.embedder.encode(question), top_k=3)
        system_prompt, user_prompt = self._build_prompt(question, chunks)

        llm_client = LLMClient(self.organization)
        result = llm_client.generate(system_prompt, user_prompt)
        answer = result["answer"]
        model = result["model"]
        provider = result["provider"]
        latency_ms = result["latency_ms"]
        input_tokens = result["input_tokens"]
        output_tokens = result["output_tokens"]
        estimated_cost = result["estimated_cost"]

        AIQuery.objects.create(
            organization=self.organization,
            user=self.user,
            api_key=self.api_key,
            query_text=question,
            response_text=answer,
            model_used=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            estimated_cost=estimated_cost,
            cache_hit=False,
            request_id=request_id,
        )

        if query_embedding is not None:
            try:
                self.semantic_cache.store(question, query_embedding, answer, model, {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "latency_ms": latency_ms,
                })
            except Exception as exc:
                logger.warning("Cache store failed: %s", exc)

        log_usage(
            organization=self.organization,
            endpoint="/api/ai/query/",
            model_used=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            estimated_cost=estimated_cost,
            cache_hit=False,
            request_id=request_id,
            user=self.user,
            api_key=self.api_key,
        )

        return {
            "answer": answer,
            "model": model,
            "provider": provider,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "latency_ms": latency_ms,
            "estimated_cost": estimated_cost,
            "cache_hit": False,
            "request_id": request_id,
            "chunks_retrieved": len(chunks),
        }

    def query(self, question: str) -> Dict[str, Any]:
        try:
            return self._run_query_async(question)
        except RuntimeError:
            return self._run_query_async(question)
