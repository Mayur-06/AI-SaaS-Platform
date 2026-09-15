import logging
from typing import List
from rag.document_loader import DocumentLoader
from rag.textchunker import TextChunker

logger = logging.getLogger(__name__)


def extract_and_chunk(file_bytes: bytes, filename: str, chunk_size: int = 500, chunk_overlap: int = 75) -> List[str]:
    import os
    import tempfile
    suffix = os.path.splitext(filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(file_bytes)
        temp_path = f.name
    try:
        loader = DocumentLoader(temp_path)
        text = loader.load()
        chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        chunks = chunker.chunk_text(text)
        return [c for c in chunks if c.strip()]
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
