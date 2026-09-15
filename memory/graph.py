import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

import json
import logging
from typing import TypedDict
import datetime

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import SupabaseVectorStore
 
from app.supabase_client import get_service_client
from app.rag.embedder import Embedder


logger = logging.getLogger(__name__)

def _api_key() -> str:
    key = os.environ["GEMINI_API_KEY"]
    if not key:
        raise RuntimeError("GEMINI_API_KEY must be set in .env")
    return key

MEMORY_EVAL_THRESHOLD = 0.7
MEMORY_LOG_PATH = os.path.join(os.path.dirname(__file__), "memory_eval_log1.jsonl")

def _log_eval_decision(
    user_id: str,
    message: str,
    decision: str,  # "saved" | "skipped_by_model" | "skipped_by_threshold" | "eval_failed"
    fact: str = "",
    confidence: float | None = None,
) -> None:
    entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": user_id,
        "message": message,
        "decision": decision,
        "fact": fact,
        "confidence": confidence,
    }
    try:
        with open(MEMORY_LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        logger.exception("failed to write memory eval log")

_eval_llm: ChatGoogleGenerativeAI | None = None

def get_eval_llm() -> ChatGoogleGenerativeAI:
    global _eval_llm
    if _eval_llm is None:
        _eval_llm=ChatGoogleGenerativeAI(
            model="gemini-3.6-flash",
            google_api_key=_api_key()
        )
    return _eval_llm


class LocalEmbeddingsAdapter(Embeddings):
    def __init__(self, embedder: Embedder):
        self._embedder = embedder

    def embed_query(self, text: str) -> list[float]:
            return self._embedder.encode(text).tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embedder.encode_batch(texts).tolist()
    
_vector_store: SupabaseVectorStore | None = None
_embedder_instance: Embedder | None = None

def _extract_text(content) -> str:
    """Gemini 3.x models can return .content as a list of content blocks
    instead of a plain string. Normalize both shapes to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and "text" in block:
                parts.append(block["text"])
        return "".join(parts)
    return str(content)


def get_vector_store() -> SupabaseVectorStore:
    global _vector_store, _embedder_instance
    if _vector_store is None:
        if _embedder_instance is None:
            _embedder_instance = Embedder()
        _vector_store = SupabaseVectorStore(
            client=get_service_client(),
            embedding=LocalEmbeddingsAdapter(_embedder_instance),
            table_name="user_memories",
            query_name="match_user_memories",
        )
    return _vector_store


class MemoryState(TypedDict):
    user_id: str
    question: str
    memories: list[str]
    should_save: bool
    fact_to_save: str


def fetch_memories(user_id: str, question: str) -> list[str]:
    try:
        results = get_vector_store().similarity_search(
            question, k=3, filter={"user_id": user_id},
        )
        return [r.page_content for r in results]
    except Exception:
        logger.exception("memory fetch failed for user %s, continuing without memories", user_id)
        return []


## will be replacing the current evaluate_and_save_memory function with the commented out one, as current is for testing purpose
# def evaluate_and_save_memory(user_id: str, question: str) -> None:
#     """Runs as a background task after the response is already sent."""
#     eval_prompt = f"""Determine if this message contains a durable personal fact
# or preference worth remembering long-term (name, role, goals, likes/dislikes,
# constraints). One-off questions are NOT durable facts.

# Message: "{question}"

# Respond with ONLY valid JSON, no markdown fences:
# {{"should_save": true or false, "fact": "concise extracted fact, or empty string"}}"""

#     try:
#         raw = eval_llm.invoke(eval_prompt).content.strip()
#         raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
#         parsed = json.loads(raw)
#     except Exception:
#         logger.warning("memory eval failed or returned non-JSON for user %s", user_id)
#         return

#     if parsed.get("should_save") and parsed.get("fact"):
#         try:
#             get_vector_store().add_texts(
#                 [parsed["fact"]], metadatas=[{"user_id": user_id}],
#             )
#         except Exception:
#             logger.exception("failed to save memory for user %s", user_id)

def evaluate_and_save_memory(user_id: str, question: str) -> None:
    """Runs as a background task after the response is already sent."""
    eval_prompt = f"""Determine if this message contains a durable personal fact
or preference worth remembering long-term about the user — something true across
many future conversations, not just relevant to this one exchange.

Durable facts: name, occupation, skills, long-term goals, stable likes/dislikes,
ongoing constraints (allergies, timezone, tools they use regularly).
NOT durable: one-off questions, requests, transient moods, or anything scoped
to "right now" rather than "generally true about me."

Examples:
Message: "What's the weather like today?"
{{"should_save": false, "fact": "", "confidence": 0.95}}

Message: "I'm a Python developer and I prefer dark mode in every app I use."
{{"should_save": true, "fact": "Python developer, prefers dark mode", "confidence": 0.9}}

Message: "Ugh I hate Mondays."
{{"should_save": false, "fact": "", "confidence": 0.6}}

Message: "I'm allergic to peanuts, keep that in mind for any recipes you give me."
{{"should_save": true, "fact": "Allergic to peanuts", "confidence": 0.95}}

Message: "Can you summarize this article for me?"
{{"should_save": false, "fact": "", "confidence": 0.95}}

Message: "I've decided I'm switching careers into machine learning."
{{"should_save": true, "fact": "Switching careers into machine learning", "confidence": 0.85}}

Now classify this message. Respond with ONLY valid JSON, no markdown fences:

Message: "{question}"
{{"should_save": bool, "fact": "concise extracted fact, or empty string", "confidence": float between 0 and 1}}"""

    try:
        raw = _extract_text(get_eval_llm().invoke(eval_prompt).content).strip()
        print(f"[MEMORY DEBUG] raw eval response: {raw!r}")
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw)
    except Exception as e:
        logger.warning("memory eval failed or returned non-JSON for user %s", user_id)
        print(f"[MEMORY DEBUG] exception: {e!r}")
        _log_eval_decision(user_id, question, "eval_failed")
        return

    should_save = bool(parsed.get("should_save", False))
    fact = parsed.get("fact", "")
    confidence = float(parsed.get("confidence", 0.0))

    if not (should_save and fact):
        _log_eval_decision(user_id, question, "skipped_by_model", fact, confidence)
        return

    if confidence < MEMORY_EVAL_THRESHOLD:
        logger.info(
            "memory eval below threshold for user %s (confidence=%.2f): %r — skipped",
            user_id, confidence, fact,
        )
        _log_eval_decision(user_id, question, "skipped_by_threshold", fact, confidence)
        return

    try:
        get_vector_store().add_texts(
            [fact], metadatas=[{"user_id": user_id}],
        )
        _log_eval_decision(user_id, question, "saved", fact, confidence)
    except Exception:
        logger.exception("failed to save memory for user %s", user_id)
        _log_eval_decision(user_id, question, "save_failed", fact, confidence)