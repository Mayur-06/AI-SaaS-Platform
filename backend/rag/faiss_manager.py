# import json
# import os

# import numpy as np


# class FAISSManager:
#     def __init__(self, embedder, user_id, base_dir="indexes"):
#         self.embedder = embedder
#         self.user_id = user_id
#         self.index_path = os.path.join(base_dir, f"{user_id}_faiss.index")
#         self.metadata_path = os.path.join(base_dir, f"{user_id}_metadata.json")

#         os.makedirs(base_dir, exist_ok=True)

#         self.index = None
#         self.metadata = {}
#         self.load()

#     def load(self):
#         if os.path.exists(self.index_path):
#             self.index = faiss.read_index(self.index_path)
#         else:
#             dim = self.embedder.embedding_dim   # use the real, already-known dimension
#             flat = faiss.IndexFlatL2(dim)
#             self.index = faiss.IndexIDMap(flat)
#             print(f"Created new FAISS index for user {self.user_id} (dim={dim})")

#         if os.path.exists(self.metadata_path):
#             with open(self.metadata_path, "r", encoding="utf-8") as f:
#                 self.metadata = json.load(f)
#         else:
#             self.metadata = {}

#         print(f"[{self.user_id}] Loaded {self.index.ntotal} vectors, {len(self.metadata)} metadata entries.")



#     # ---------------------------------------------------
#     # Save index + metadata
#     # ---------------------------------------------------

#     def save(self):

#         faiss.write_index(
#             self.index,
#             self.index_path,
#         )

#         with open(
#             self.metadata_path,
#             "w",
#             encoding="utf-8",
#         ) as f:

#             json.dump(
#                 self.metadata,
#                 f,
#                 indent=4,
#                 ensure_ascii=False,
#             )

#     # ---------------------------------------------------
#     # Search
#     # ---------------------------------------------------

#     def search(
#         self,
#         query_embedding,
#         top_k=3,
#     ):

#         query_embedding = np.array(
#             [query_embedding],
#             dtype="float32",
#         )

#         scores, ids = self.index.search(
#             query_embedding,
#             top_k,
#         )

#         results = []

#         for score, chunk_id in zip(
#             scores[0],
#             ids[0],
#         ):

#             if chunk_id == -1:
#                 continue

#             results.append(
#                 {
#                     "chunk_id": int(chunk_id),
#                     "score": float(score),
#                     "doc_id": self.metadata[str(chunk_id)]["doc_id"],
#                     "text": self.metadata[str(chunk_id)]["text"],
#                 }
#             )

#         return results

#     # ---------------------------------------------------
#     # Get next available chunk id
#     # ---------------------------------------------------

#     def next_chunk_id(self):

#         if not self.metadata:
#             return 0

#         return (
#             max(
#                 int(i)
#                 for i in self.metadata.keys()
#             )
#             + 1
#         )

#     # ---------------------------------------------------
#     # Add document
#     # ---------------------------------------------------

#     def add_document(
#     self,
#     doc_id,
#     chunks,
#                 ):
#         embeddings = self.embedder.encode_batch(chunks)
        
#         embeddings = np.asarray(
#             embeddings,
#             dtype="float32",
#         )

#         if embeddings.ndim == 1:
#             embeddings = embeddings.reshape(1, -1)

#         start = self.next_chunk_id()

#         ids = np.arange(
#             start,
#             start + len(chunks),
#             dtype=np.int64,
#         )

#         self.index.add_with_ids(
#             embeddings,
#             ids,
#         )

#         for chunk_id, chunk in zip(ids, chunks):

#             self.metadata[str(int(chunk_id))] = {
#                 "chunk_id": int(chunk_id),
#                 "doc_id": doc_id,
#                 "text": chunk,
#             }
#         self.save()

#         return len(chunks)

#     # ---------------------------------------------------
#     # Delete document
#     # ---------------------------------------------------

#     def delete_document(
#         self,
#         document_name,
#     ):

#         ids_to_delete = []

#         for chunk_id, data in self.metadata.items():

#             if data["doc_id"] == document_name:
#                 ids_to_delete.append(int(chunk_id))

#         if not ids_to_delete:
#             return 0

#         self.index.remove_ids(
#             np.array(
#                 ids_to_delete,
#                 dtype=np.int64,
#             )
#         )

#         for chunk_id in ids_to_delete:
#             del self.metadata[str(chunk_id)]

#         self.save()

#         return len(ids_to_delete)

#     # ---------------------------------------------------
#     # List uploaded documents
#     # ---------------------------------------------------

#     def list_documents(self):

#         return sorted(
#             {
#                 value["doc_id"]
#                 for value in self.metadata.values()
#             }
#         )