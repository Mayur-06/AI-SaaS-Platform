import logging
import time
import hashlib
from typing import Optional, Dict, List, Any
from django.utils import timezone
from datetime import timedelta
from accounts.models import Organization
from ai_service.models import CacheEntry
from billing.models import Plan
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    from middleware.redis_utils import get_redis_client
except ImportError:
    get_redis_client = None


def get_cache_ttl(org: Organization) -> int:
    plan_name = (org.plan.name or "free").lower()
    return {
        "free": getattr(settings, "CACHE_TTL_FREE", 3600),
        "pro": getattr(settings, "CACHE_TTL_PRO", 86400),
        "enterprise": getattr(settings, "CACHE_TTL_ENTERPRISE", 604800),
    }.get(plan_name, 3600)


def get_default_threshold() -> float:
    return 0.95


class SemanticCache:
    def __init__(self, organization: Organization, threshold: Optional[float] = None):
        self.organization = organization
        self.threshold = threshold if threshold is not None else get_default_threshold()
        self._redis = get_redis_client() if get_redis_client else None

    def _namespace(self, cache_key: str) -> str:
        return f"semantic:{self.organization.id}:{cache_key}"

    def lookup(self, query_embedding, query_text: str) -> Optional[Dict[str, Any]]:
        entries = CacheEntry.objects.filter(
            organization=self.organization,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at")[:200]

        best_score = 0.0
        best_entry = None
        for entry in entries:
            if entry.embedding_vector:
                try:
                    import numpy as np
                    stored = np.array(entry.embedding_vector, dtype=np.float32)
                    norm_q = np.linalg.norm(query_embedding)
                    norm_s = np.linalg.norm(stored)
                    if norm_q == 0 or norm_s == 0:
                        continue
                    score = float(np.dot(query_embedding, stored) / (norm_q * norm_s))
                    if score > best_score:
                        best_score = score
                        best_entry = entry
                except Exception as exc:
                    logger.debug("Cache score calc failed: %s", exc)

        if best_entry and best_score >= self.threshold:
            logger.info("Cache hit (score=%.4f) for org %s", best_score, self.organization.id)
            return {
                "answer": best_entry.response_text,
                "model": best_entry.model,
                "cache_hit": True,
                "score": best_score,
                "cache_entry_id": str(best_entry.id),
            }
        return None

    def store(self, query_text: str, query_embedding, response_text: str, model: str, token_metadata: Optional[Dict] = None) -> CacheEntry:
        ttl = get_cache_ttl(self.organization)
        cache_key = hashlib.sha256(query_text.encode()).hexdigest()[:32]
        expires_at = timezone.now() + timedelta(seconds=ttl)
        embedding_list = query_embedding.tolist() if hasattr(query_embedding, "tolist") else list(query_embedding)
        entry = CacheEntry.objects.create(
            organization=self.organization,
            cache_key=cache_key,
            query_text=query_text,
            model=model,
            response_text=response_text,
            token_metadata=token_metadata or {},
            expires_at=expires_at,
            embedding_vector=embedding_list,
        )
        logger.debug("Cached response for org %s, key %s", self.organization.id, cache_key)
        return entry

    def clear(self):
        CacheEntry.objects.filter(organization=self.organization).delete()
        logger.info("Cache cleared for org %s", self.organization.id)

    def get_stats(self) -> Dict[str, Any]:
        total = CacheEntry.objects.filter(organization=self.organization).count()
        valid = CacheEntry.objects.filter(organization=self.organization, expires_at__gt=timezone.now()).count()
        return {"total_entries": total, "valid_entries": valid}
