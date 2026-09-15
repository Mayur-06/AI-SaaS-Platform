"""Supabase-backed replacement for FAISSManager.

Same public interface as the old FAISSManager (search, add_document,
delete_document, list_documents), so pipeline.py and chat.py don't need
to change beyond the single instantiation line in get_rag_for_user().
"""

import numpy as np

from app.supabase_client import get_service_client

INSERT_CHUNK_SIZE = 500  # batch size for large document uploads


class SupabaseDocumentStore:
    def __init__(self, embedder, user_id, base_dir=None):
        # base_dir kept as an accepted-but-unused kwarg so existing call
        # sites that might pass it don't break.
        self.embedder = embedder
        self.user_id = str(user_id)
        self.client = get_service_client()

    # ---------------------------------------------------
    # Search
    # ---------------------------------------------------
    def search(self, query_embedding, top_k=3):
        if isinstance(query_embedding, np.ndarray):
            query_embedding = query_embedding.tolist()

        response = (
            self.client.rpc(
                "match_document_chunks",
                {
                    "query_embedding": query_embedding,
                    "filter": {"user_id": self.user_id},
                },
            )
            .limit(top_k)
            .execute()
        )

        results = []
        for row in response.data:
            results.append(
                {
                    "chunk_id": row["id"],
                    "score": row["similarity"],  # NOTE: higher = more similar (cosine), unlike old FAISS L2 distance
                    "doc_id": row["doc_id"],
                    "text": row["content"],
                }
            )
        return results

    # ---------------------------------------------------
    # Add document
    # ---------------------------------------------------
    def add_document(self, doc_id, chunks):
        embeddings = self.embedder.encode_batch(chunks)
        embeddings = np.asarray(embeddings, dtype="float32")
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)

        rows = [
            {
                "user_id": self.user_id,
                "doc_id": doc_id,
                "content": chunk,
                "embedding": emb.tolist(),
            }
            for chunk, emb in zip(chunks, embeddings)
        ]

        for i in range(0, len(rows), INSERT_CHUNK_SIZE):
            batch = rows[i : i + INSERT_CHUNK_SIZE]
            self.client.table("document_chunks").insert(batch).execute()

        return len(chunks)

    # ---------------------------------------------------
    # Delete document
    # ---------------------------------------------------
    def delete_document(self, document_name):
        result = (
            self.client.table("document_chunks")
            .delete()
            .eq("user_id", self.user_id)
            .eq("doc_id", document_name)
            .execute()
        )
        return len(result.data)

    # ---------------------------------------------------
    # List uploaded documents
    # ---------------------------------------------------
    def list_documents(self):
        result = (
            self.client.table("document_chunks")
            .select("doc_id")
            .eq("user_id", self.user_id)
            .execute()
        )
        return sorted({row["doc_id"] for row in result.data})