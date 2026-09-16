import logging
import numpy as np
from typing import List, Dict, Any, Optional

from ai_service.models import Document, DocumentChunk
from accounts.models import Organization
from rag.embedder import Embedder

logger = logging.getLogger(__name__)


class DjangoDocumentStore:
    def __init__(self, organization: Organization, embedder: Optional[Embedder] = None):
        self.organization = organization
        self.embedder = embedder or Embedder()

    def search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Dict[str, Any]]:
        if isinstance(query_embedding, list):
            query_embedding = np.array(query_embedding, dtype=np.float32)
        from django.db import connection
        from django.contrib.postgres.search import SearchVector

        chunks = DocumentChunk.objects.filter(
            organization=self.organization
        ).select_related("document")[: min(top_k * 10, 100)]

        scored = []
        for chunk in chunks:
            if chunk.embedding_vector:
                try:
                    stored = np.array(chunk.embedding_vector, dtype=np.float32)
                    norm_q = np.linalg.norm(query_embedding)
                    norm_s = np.linalg.norm(stored)
                    if norm_q == 0 or norm_s == 0:
                        score = 0.0
                    else:
                        score = float(np.dot(query_embedding, stored) / (norm_q * norm_s))
                    scored.append((score, chunk))
                except Exception as exc:
                    logger.debug("Score calculation failed for chunk %s: %s", chunk.id, exc)

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, chunk in scored[:top_k]:
            results.append({
                "chunk_id": str(chunk.id),
                "score": score,
                "doc_id": str(chunk.document.id),
                "text": chunk.chunk_text,
            })
        return results

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
