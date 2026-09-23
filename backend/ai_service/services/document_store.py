import logging
import numpy as np
from typing import List, Dict, Any, Optional

from ai_service.models import Document, DocumentChunk
from accounts.models import Organization
from rag.embedder import Embedder

logger = logging.getLogger(__name__)


STOPWORDS = {
    "the", "and", "is", "in", "it", "of", "to", "for", "with", "on", "at", "by", "from",
    "an", "be", "this", "that", "which", "or", "as", "are", "was", "were", "what", "how",
    "why", "who", "when", "where", "can", "could", "should", "would", "do", "does", "did",
    "give", "tell", "explain", "summarize", "find", "show", "me", "you", "your", "my", "our",
    "about", "all", "any", "been", "have", "has", "had", "more", "some", "such", "than", "then"
}


class DjangoDocumentStore:
    def __init__(self, organization: Organization, embedder: Optional[Embedder] = None):
        self.organization = organization
        self._embedder = embedder

    @property
    def embedder(self) -> Optional[Embedder]:
        if self._embedder is None:
            try:
                self._embedder = Embedder()
            except Exception as exc:
                logger.warning("Failed to initialize embedder for document store: %s", exc)
        return self._embedder

    def search(
        self,
        query_embedding: Optional[np.ndarray],
        query_text: Optional[str] = None,
        top_k: int = 8,
        min_similarity: float = 0.15,
        target_doc_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        High-performance Hybrid Search across ALL document chunks for the organization:
        1. Evaluates all ready document chunks (no premature slicing).
        2. Vectorized C-level matrix multiplication for dense cosine similarity.
        3. Lexical / BM25 term frequency matching for sparse keyword lookup.
        4. Reciprocal Rank Fusion (RRF) to combine semantic concepts and exact keyword matches.
        5. Contextual stitching of adjacent chunks to provide unbroken context passages.
        """
        import math
        import re

        if query_embedding is None and not query_text:
            return []

        if query_embedding is not None and isinstance(query_embedding, list):
            query_embedding = np.array(query_embedding, dtype=np.float32)

        # 1. Fetch all candidate chunks for this organization
        chunks_qs = DocumentChunk.objects.filter(
            organization=self.organization,
            document__status=Document.STATUS_READY,
        )
        if target_doc_id:
            chunks_qs = chunks_qs.filter(document_id=target_doc_id)

        chunk_data = list(
            chunks_qs.values(
                "id",
                "document_id",
                "document__filename",
                "document__title",
                "chunk_index",
                "chunk_text",
                "embedding_vector",
            ).order_by("document_id", "chunk_index")
        )

        if not chunk_data:
            return []

        num_chunks = len(chunk_data)

        # 2. Dense Semantic Search (Vectorized Cosine Similarity)
        dense_scores = np.zeros(num_chunks, dtype=np.float32)
        if query_embedding is not None:
            norm_q = float(np.linalg.norm(query_embedding))
            if norm_q > 0:
                query_unit = (query_embedding / norm_q).astype(np.float32)
                expected_dim = len(query_unit)

                valid_chunk_indices = []
                vectors_list = []
                for idx, item in enumerate(chunk_data):
                    ev = item.get("embedding_vector")
                    if ev and len(ev) == expected_dim:
                        vectors_list.append(ev)
                        valid_chunk_indices.append(idx)

                if vectors_list:
                    matrix = np.array(vectors_list, dtype=np.float32)
                    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
                    norms[norms == 0] = 1.0
                    matrix_unit = matrix / norms
                    sims = np.dot(matrix_unit, query_unit)
                    for i, c_idx in enumerate(valid_chunk_indices):
                        dense_scores[c_idx] = max(0.0, float(sims[i]))

        # 3. Sparse Keyword Search (Sublinear Term Matching + Phrase Boost)
        sparse_scores = np.zeros(num_chunks, dtype=np.float32)
        if query_text:
            clean_q = query_text.lower().strip()
            terms = [t for t in re.findall(r"\b\w+\b", clean_q) if len(t) >= 2]
            meaningful_terms = [t for t in terms if t not in STOPWORDS]
            search_terms = meaningful_terms if meaningful_terms else terms

            if search_terms:
                for idx, item in enumerate(chunk_data):
                    t_lower = item["chunk_text"].lower()
                    score = 0.0

                    # Exact multi-word query phrase boost
                    if len(clean_q) > 4 and clean_q in t_lower:
                        score += 3.5

                    # Term frequency with log-saturation
                    for term in search_terms:
                        cnt = t_lower.count(term)
                        if cnt > 0:
                            weight = 2.5 if len(term) >= 6 else (1.5 if len(term) >= 4 else 1.0)
                            score += weight * (1.0 + math.log(cnt))

                    if score > 0:
                        # Normalize by square root of length to prevent bias toward massive blocks
                        sparse_scores[idx] = score / math.sqrt(max(len(t_lower), 50))

        # 4. Reciprocal Rank Fusion (RRF) Ranking
        has_dense = bool(query_embedding is not None and np.any(dense_scores > 0))
        has_sparse = bool(query_text and np.any(sparse_scores > 0))

        if has_dense and has_sparse:
            dense_order = np.argsort(-dense_scores)
            dense_ranks = {idx: rank + 1 for rank, idx in enumerate(dense_order)}

            sparse_order = np.argsort(-sparse_scores)
            sparse_ranks = {idx: rank + 1 for rank, idx in enumerate(sparse_order)}

            k_rrf = 60.0
            candidate_pool = []
            for idx, item in enumerate(chunk_data):
                d_sim = float(dense_scores[idx])
                s_sim = float(sparse_scores[idx])

                # Reject if below min_similarity and no keyword matches
                if d_sim < min_similarity and s_sim <= 0.0:
                    continue

                d_rank = dense_ranks.get(idx, 9999)
                s_rank = sparse_ranks.get(idx, 9999)

                # 65% weight on semantic meaning, 35% on exact keyword alignment
                rrf_score = (0.65 / (k_rrf + d_rank)) + (0.35 / (k_rrf + s_rank))
                combined_score = max(d_sim, min(1.0, d_sim * 0.7 + s_sim * 0.3))

                candidate_pool.append({
                    "rrf": rrf_score,
                    "score": combined_score,
                    "item": item,
                })

            candidate_pool.sort(key=lambda x: x["rrf"], reverse=True)
        else:
            primary_scores = dense_scores if has_dense else sparse_scores
            candidate_pool = []
            for idx, item in enumerate(chunk_data):
                sc = float(primary_scores[idx])
                if sc >= (min_similarity if has_dense else 0.01):
                    candidate_pool.append({
                        "rrf": sc,
                        "score": sc,
                        "item": item,
                    })
            candidate_pool.sort(key=lambda x: x["score"], reverse=True)

        if not candidate_pool:
            return []

        # 5. Contextual Stitching & Adjacent Chunk Merging
        pool_to_stitch = candidate_pool[: max(top_k * 2, top_k + 4)]
        seen_chunk_ids = set()
        final_results = []

        for cand in pool_to_stitch:
            item = cand["item"]
            cid = str(item["id"])
            if cid in seen_chunk_ids:
                continue

            doc_id = str(item["document_id"])
            c_idx = item["chunk_index"]
            raw_filename = item.get("document__filename") or "Document"
            title = item.get("document__title") or ""
            clean_name = title if title else (raw_filename.split("/")[-1].split("\\")[-1])

            # Check if immediately consecutive chunk (chunk_index + 1) is in our candidate pool
            consecutive = next(
                (
                    c for c in pool_to_stitch
                    if str(c["item"]["document_id"]) == doc_id
                    and c["item"]["chunk_index"] == c_idx + 1
                    and str(c["item"]["id"]) not in seen_chunk_ids
                ),
                None,
            )

            if consecutive:
                # Merge consecutive chunks into an unbroken passage
                consec_item = consecutive["item"]
                seen_chunk_ids.add(cid)
                seen_chunk_ids.add(str(consec_item["id"]))
                merged_text = item["chunk_text"].strip() + "\n\n" + consec_item["chunk_text"].strip()
                merged_score = max(cand["score"], consecutive["score"])
                final_results.append({
                    "chunk_id": f"{cid}+{consec_item['id']}",
                    "score": merged_score,
                    "doc_id": doc_id,
                    "doc_title": clean_name,
                    "chunk_index": c_idx,
                    "text": merged_text,
                })
            else:
                seen_chunk_ids.add(cid)
                final_results.append({
                    "chunk_id": cid,
                    "score": cand["score"],
                    "doc_id": doc_id,
                    "doc_title": clean_name,
                    "chunk_index": c_idx,
                    "text": item["chunk_text"],
                })

            if len(final_results) >= top_k:
                break

        return final_results

    def add_document(self, doc_id: str, chunks: List[str]) -> int:
        from django.db import transaction
        try:
            document = Document.objects.get(id=doc_id, organization=self.organization)
        except Document.DoesNotExist:
            logger.error("Document %s not found for org %s", doc_id, self.organization.id)
            return 0

        document.status = Document.STATUS_PROCESSING
        document.save(update_fields=["status"])

        embeddings = self.embedder.encode_batch(chunks)
        chunk_objects = []
        for idx, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
            chunk_objects.append(DocumentChunk(
                document=document,
                organization=self.organization,
                chunk_text=chunk_text,
                embedding_vector=emb.tolist() if hasattr(emb, "tolist") else list(emb),
                chunk_index=idx,
            ))

        with transaction.atomic():
            DocumentChunk.objects.bulk_create(chunk_objects, batch_size=100)
            document.status = Document.STATUS_READY
            document.save(update_fields=["status"])
        return len(chunk_objects)

    def delete_document(self, document_name: str) -> int:
        try:
            document = Document.objects.get(
                filename=document_name,
                organization=self.organization,
            )
            count, _ = DocumentChunk.objects.filter(document=document).delete()
            document.delete()
            return count
        except Document.DoesNotExist:
            return 0

    def list_documents(self) -> List[str]:
        return list(
            Document.objects.filter(organization=self.organization, status=Document.STATUS_READY)
            .values_list("filename", flat=True)
            .distinct()
            .order_by("filename")
        )
