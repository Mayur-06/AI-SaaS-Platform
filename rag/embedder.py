from sentence_transformers import SentenceTransformer
import numpy as np


class Embedder:
    """
    Wrapper around SentenceTransformer embedding model.
    """

    def __init__(self, model_name="BAAI/bge-small-en-v1.5"):
        print(f"Loading embedding model: {model_name}")

        self.model = SentenceTransformer(model_name)

        self.embedding_dim = self.model.get_embedding_dimension()

        print("Embedding model loaded successfully.")
        print(f"Embedding dimension: {self.embedding_dim}")

    def encode(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text.
        """

        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embedding.astype("float32")

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        """
        Generate embeddings for multiple texts.
        """

        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embeddings.astype("float32")