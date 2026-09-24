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


    def _get_search_query(self, question: str, history: Optional[List[Dict]] = None) -> str:
        if not history:
            return question
        last_q = (history[-1].get("question") or history[-1].get("query") or "").strip()
        if not last_q:
            return question

        referential_markers = {
            "it", "they", "them", "this", "that", "these", "those",
            "second", "third", "former", "latter", "previous", "above",
            "same", "other", "another"
        }
        lower_q = question.lower().strip()
        import re
        words = set(re.findall(r"\b\w+\b", lower_q))

        has_pronoun = bool(words & referential_markers)
        has_phrase = any(
            phrase in lower_q for phrase in [
                "what about", "how about", "explain more", "tell me more",
                "why is that", "what if", "can you clarify", "elaborate on"
            ]
        )
        is_fragment = len(lower_q.split()) <= 3

        if has_pronoun or has_phrase or is_fragment:
            return f"{last_q} {question}"
        return question

    def _sanitize_conversation_history(
        self, history: Optional[List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Safely prunes conversation turns whose underlying documents have been deleted.
        Ensures context from removed documents is never leaked into prompt context
        or follow-up query reformulations.
        """
        if not history:
            return []

        active_doc_ids = set(
            str(did)
            for did in Document.objects.filter(
                organization=self.organization,
                status=Document.STATUS_READY,
            ).values_list("id", flat=True)
        )

        clean_history = []
        for turn in history:
            ref_docs = turn.get("source_doc_ids")
            # If source_doc_ids was tracked and non-empty:
            if ref_docs is not None and len(ref_docs) > 0:
                has_active_doc = any(str(did) in active_doc_ids for did in ref_docs)
                if not has_active_doc:
                    # All source documents referenced by this turn were deleted; prune this turn
                    continue
            clean_history.append(turn)

        return clean_history

    def _build_prompt(self, question: str, chunks: List[Dict], conversation_history: Optional[List[Dict]] = None) -> tuple:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            doc_name = chunk.get("doc_title") or chunk.get("doc_id", "Document")
            chunk_idx = chunk.get("chunk_index", i - 1)
            score_info = f" (relevance: {chunk['score']:.2f})" if "score" in chunk else ""
            context_parts.append(
                f"[Source {i}: {doc_name} | Section {chunk_idx + 1}{score_info}]\n{chunk['text']}"
            )
        context = "\n\n".join(context_parts) if context_parts else "No relevant documents found."

        history_block = ""
        if conversation_history:
            turns = []
            for item in conversation_history[-3:]:
                q = (item.get("question") or item.get("query") or "").strip()
                a = (item.get("answer") or item.get("response") or "").strip()
                if q and a:
                    a_snippet = a[:400] + ("..." if len(a) > 400 else "")
                    turns.append(f"User: {q}\nAI: {a_snippet}")
            if turns:
                history_block = "Previous Conversation Context:\n" + "\n\n".join(turns) + "\n\n---\n\n"

        system_prompt = """You are an expert AI assistant providing clear, precise, and well-structured answers based on uploaded knowledge base documents.

Factual Grounding & Document Availability Rules:
1. Your factual answers MUST be derived ONLY from the "Context from uploaded documents" provided in this prompt.
2. The "Previous Conversation Context" (if present) is provided solely for conversational continuity, flow, and pronoun resolution.
3. If a document or fact was mentioned in previous conversation turns but is NOT present in the current uploaded context, treat it as deleted or unavailable. You must state clearly that you do not have access to that document or information anymore. Do NOT recall, confirm, or hallucinate its details.
4. If the question cannot be answered from the provided documents, state so clearly and concisely without hallucinating.

Formatting & Markdown Instructions:
- Format your response using clean, professional Markdown.
- Use clear headers (`### Section Title`) to structure different parts of your answer logically.
- Use bullet points (`- `) or numbered lists for sequential steps, recommendations, or key takeaways.
- Use **bold** text for key concepts, critical rules, metrics, or terms to emphasize important details.
- Use inline code (`code`) for technical names, parameters, commands, or identifiers, and fenced code blocks (```language ... ```) for code snippets or structured configurations.
- When referencing specific facts from the uploaded context documents, cite the source document name naturally (e.g. `*Source: [filename]*`).
- Synthesize information across all relevant provided sections and documents to give a thorough, comprehensive answer.
- Keep the response organized, readable, and direct without unnecessary filler."""

        user_prompt = f"""{history_block}Context from uploaded documents:
{context}

Question: {question}"""
        return system_prompt, user_prompt

    def _run_query_async(
        self,
        question: str,
        target_model: Optional[str] = None,
        top_k: int = 8,
        target_doc_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        from datetime import timedelta
        from django.utils import timezone

        # If conversation_history is not provided (None), automatically check recent AIQuery records
        # within the last 15 minutes. Scoped to the specific api_key if authenticated via API key,
        # or scoped to the user if authenticated via user session.
        if conversation_history is None:
            try:
                recent_cutoff = timezone.now() - timedelta(minutes=15)
                query_filter = {
                    "organization": self.organization,
                    "created_at__gte": recent_cutoff,
                }
                if self.api_key is not None:
                    query_filter["api_key"] = self.api_key
                elif self.user is not None and getattr(self.user, "is_authenticated", False):
                    query_filter["user"] = self.user
                else:
                    query_filter = None

                if query_filter:
                    recent_records = list(
                        AIQuery.objects.filter(**query_filter).order_by("-created_at")[:2]
                    )
                    recent_records.reverse()
                    conversation_history = [
                        {
                            "question": r.query_text,
                            "answer": r.response_text,
                            "source_doc_ids": r.source_doc_ids or [],
                        }
                        for r in recent_records
                    ]
            except Exception as exc:
                logger.debug("Failed to fetch recent queries for context: %s", exc)
                conversation_history = None

        # Sanitize conversation history against active documents
        conversation_history = self._sanitize_conversation_history(conversation_history)

        search_query = self._get_search_query(question, conversation_history)

        query_embedding = None
        if self.embedder is not None:
            try:
                query_embedding = self.embedder.encode(search_query)
            except Exception as exc:
                logger.warning("Embedding failed, proceeding without cache lookup: %s", exc)
                query_embedding = None

        request_id = str(__import__("uuid").uuid4())

        # For cache lookup: if there is conversation history and the search query was contextualized,
        # use search_query for cache lookup to avoid false hits on ambiguous short follow-ups.
        cache_query_text = search_query if (conversation_history and search_query != question) else question

        if query_embedding is not None or cache_query_text:
            cache_result = self.semantic_cache.lookup(query_embedding, cache_query_text)
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
                    source_doc_ids=cache_result.get("source_doc_ids", []),
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
                    "source_doc_ids": cache_result.get("source_doc_ids", []),
                }

        chunks = (
            self.document_store.search(
                query_embedding=query_embedding,
                query_text=search_query,
                top_k=top_k,
                target_doc_id=target_doc_id,
            )
            if (query_embedding is not None or search_query)
            else []
        )
        system_prompt, user_prompt = self._build_prompt(question, chunks, conversation_history)

        llm_client = LLMClient(self.organization)
        result = llm_client.generate(system_prompt, user_prompt, target_model=target_model)
        answer = result["answer"]
        model = result["model"]
        provider = result["provider"]
        latency_ms = result["latency_ms"]
        input_tokens = result["input_tokens"]
        output_tokens = result["output_tokens"]
        estimated_cost = result["estimated_cost"]

        source_doc_ids = list({str(c["doc_id"]) for c in chunks if c.get("doc_id")})

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
            source_doc_ids=source_doc_ids,
        )

        # Only store in semantic cache if actual document chunks were retrieved and used,
        # preventing caching of negative responses (e.g. "no documents found")
        if query_embedding is not None and chunks and source_doc_ids:
            try:
                self.semantic_cache.store(cache_query_text, query_embedding, answer, model, {
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
            "source_doc_ids": source_doc_ids,
        }

    def query(
        self,
        question: str,
        model: Optional[str] = None,
        top_k: int = 8,
        target_doc_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        return self._run_query_async(
            question,
            target_model=model,
            top_k=top_k,
            target_doc_id=target_doc_id,
            conversation_history=conversation_history,
        )
