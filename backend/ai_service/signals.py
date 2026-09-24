import logging
from django.db.models.signals import post_delete
from django.dispatch import receiver
from ai_service.models import Document, AIQuery, CacheEntry

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Document)
def on_document_deleted(sender, instance, **kwargs):
    """
    Safely invalidates cached answers and purges deleted document attribution
    when a Document record is deleted.
    """
    org = getattr(instance, "organization", None)
    if not org:
        return

    # 1. Invalidate SemanticCache for the organization to prevent serving stale answers
    try:
        from ai_service.services.semantic_cache import SemanticCache
        cache = SemanticCache(org)
        cache.clear()
        logger.info("Cleared semantic cache for org %s following deletion of document %s", org.id, instance.id)
    except Exception as exc:
        logger.warning("Failed to clear semantic cache on document deletion: %s", exc)

    # 2. Clean up AIQuery records that depended on this deleted document
    try:
        doc_id_str = str(instance.id)
        matching_queries = list(AIQuery.objects.filter(organization=org))
        for q in matching_queries:
            if q.source_doc_ids and doc_id_str in q.source_doc_ids:
                remaining_docs = [did for did in q.source_doc_ids if did != doc_id_str]
                if not remaining_docs:
                    # If this was the only document providing context, delete the query record
                    # so it never leaks into future auto-fetched history
                    q.delete()
                else:
                    q.source_doc_ids = remaining_docs
                    q.save(update_fields=["source_doc_ids"])
    except Exception as exc:
        logger.warning("Failed to clean up AIQuery records on document deletion: %s", exc)
