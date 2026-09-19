import logging
import threading
import gc
import time
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class Embedder:
    """
    Wrapper around SentenceTransformer embedding model.
    Caches loaded model instances to avoid reloading weights into memory
    on every request, preventing OS paging file exhaustion (os error 1455).
    """

    _model_cache = {}
    _lock = threading.Lock()

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = self._get_or_load_model(model_name)
        if self.model is not None:
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
        else:
            self.embedding_dim = 384

    @classmethod
    def _get_or_load_model(cls, model_name: str):
        if model_name in cls._model_cache:
            return cls._model_cache[model_name]

        with cls._lock:
            if model_name in cls._model_cache:
                return cls._model_cache[model_name]

            # Limit PyTorch CPU threads on Windows to prevent excessive virtual memory commitment
            try:
                import torch
                if torch.get_num_threads() > 2:
                    torch.set_num_threads(2)
            except Exception:
                pass

            logger.info("Loading embedding model: %s", model_name)
            print(f"Loading embedding model: {model_name}")

            for attempt in range(2):
                try:
                    model = SentenceTransformer(model_name)
                    cls._model_cache[model_name] = model
                    print("Embedding model loaded successfully.")
                    print(f"Embedding dimension: {model.get_sentence_embedding_dimension()}")
                    return model
                except (OSError, MemoryError) as exc:
                    logger.warning(
                        "Attempt %d: Memory/paging error loading %s: %s. Running GC...",
                        attempt + 1,
                        model_name,
                        exc,
                    )
                    gc.collect()
                    time.sleep(1)
                    if attempt == 1:
                        logger.error("Failed to load %s after retry: %s", model_name, exc)
                        raise
                except Exception as exc:
                    logger.error("Unexpected error loading %s: %s", model_name, exc)
                    raise

    def encode(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text.
        """
        if not text:
            return np.zeros(self.embedding_dim, dtype="float32")

        if self.model is None:
            raise RuntimeError("Embedding model is not loaded.")

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
        if not texts:
            return np.zeros((0, self.embedding_dim), dtype="float32")

        if self.model is None:
            raise RuntimeError("Embedding model is not loaded.")

        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embeddings.astype("float32")