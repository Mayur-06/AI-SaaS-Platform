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
        try:
            self.embedder = Embedder()
        except Exception as exc:
            logger.warning("Embedder initialization failed: %s", exc)
            self.embedder = None
        self.document_store = DjangoDocumentStore(organization, self.embedder)
        self.model_router = ModelRouter(organization)
        self.semantic_cache = SemanticCache(organization)
        self.text_chunker = TextChunker()


    def _build_prompt(self, question: str, chunks: List[Dict]) -> tuple:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            doc_name = chunk.get("doc_title") or chunk.get("doc_id", "unknown")
            context_parts.append(f"[Document {i}] (source={doc_name})\n{chunk['text']}")
        context = "\n\n".join(context_parts) if context_parts else "No relevant documents found."

        system_prompt = """You are an expert AI assistant providing clear, precise, and well-structured answers based on uploaded knowledge base documents.

Formatting & Markdown Instructions:
- Format your response using clean, professional Markdown.
- Use clear headers (`### Section Title`) to structure different parts of your answer logically.
- Use bullet points (`- `) or numbered lists for sequential steps, recommendations, or key takeaways.
- Use **bold** text for key concepts, critical rules, metrics, or terms to emphasize important details.
- Use inline code (`code`) for technical names, parameters, commands, or identifiers, and fenced code blocks (```language ... ```) for code snippets or structured configurations.
- When referencing specific facts from the uploaded context documents, cite the source document name naturally (e.g. `*Source: [filename]*`).
- If the question cannot be answered from the provided documents, state so clearly and concisely without hallucinating.
- Keep the response organized, readable, and direct without unnecessary filler."""

        user_prompt = f"""Context from uploaded documents:
{context}

Question: {question}"""
        return system_prompt, user_prompt

    def _run_query_async(self, question: str, target_model: Optional[str] = None) -> Dict[str, Any]:
        query_embedding = None
        if self.embedder is not None:
            try:
                query_embedding = self.embedder.encode(question)
            except Exception as exc:
                logger.warning("Embedding failed, proceeding without cache lookup: %s", exc)
                query_embedding = None

        request_id = str(__import__("uuid").uuid4())

        if query_embedding is not None or question:
            cache_result = self.semantic_cache.lookup(query_embedding, question)
            cached_model = cache_result.get("model") if cache_result else None
            is_model_match = (
                not target_model
                or target_model == "auto"
                or (cached_model and cached_model == target_model)
            )
            if cache_result and is_model_match:
                out_tokens = len(cache_result["answer"].split())
                log_usage(
                    organization=self.organization,
                    endpoint="/api/ai/query/",
                    model_used=cache_result.get("model", "cached"),
                    cache_hit=True,
                    request_id=request_id,
                    user=self.user,
                    api_key=self.api_key,
                )
                AIQuery.objects.create(
                    organization=self.organization,
                    user=self.user,
                    api_key=self.api_key,
                    query_text=question,
                    response_text=cache_result["answer"],
                    model_used=cache_result.get("model", "cached"),
                    input_tokens=0,
                    output_tokens=out_tokens,
                    latency_ms=0,
                    estimated_cost=0,
                    cache_hit=True,
                    request_id=request_id,
                )
                return {
                    "answer": cache_result["answer"],
                    "model": cache_result.get("model"),
                    "provider": "cache",
                    "input_tokens": 0,
                    "output_tokens": out_tokens,
                    "latency_ms": 0,
                    "estimated_cost": 0,
                    "cache_hit": True,
                    "request_id": request_id,
                }

        chunks = self.document_store.search(query_embedding, top_k=3) if query_embedding is not None else []
        system_prompt, user_prompt = self._build_prompt(question, chunks)

        llm_client = LLMClient(self.organization)
        result = llm_client.generate(system_prompt, user_prompt, target_model=target_model)
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

        cited_chunks = [
            {
                "document_title": c.get("doc_title") or c.get("doc_id", "Document"),
                "chunk_index": c.get("chunk_index", 0),
                "content": c.get("text", ""),
                "score": round(float(c.get("score", 0)), 3),
            }
            for c in chunks
        ]

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
            "cited_chunks": cited_chunks,
        }

    def query(self, question: str, model: Optional[str] = None) -> Dict[str, Any]:
        try:
            return self._run_query_async(question, target_model=model)
        except RuntimeError:
            return self._run_query_async(question, target_model=model)
