import logging
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from billing.models import UsageLog, UsageAggregate
from accounts.models import Organization

logger = logging.getLogger(__name__)


def log_usage(
    organization: Organization,
    endpoint: str,
    model_used: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
    estimated_cost: float = 0,
    cache_hit: bool = False,
    request_id: str = None,
    user=None,
    api_key=None,
):
    try:
        with transaction.atomic():
            log = UsageLog.objects.create(
                organization=organization,
                user=user,
                api_key=api_key,
                endpoint=endpoint,
                model_used=model_used,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
                estimated_cost=estimated_cost,
                cache_hit=cache_hit,
                request_id=request_id,
            )
            now = timezone.now()
            month_str = now.strftime("%Y-%m")
            agg, _ = UsageAggregate.objects.get_or_create(
                organization=organization,
                month=month_str,
                defaults={"date": now.date()},
            )
            agg.total_requests = UsageAggregate._meta.get_field("total_requests").value_from_object(agg) + 1
            agg.input_tokens += input_tokens
            agg.output_tokens += output_tokens
            agg.total_cost += estimated_cost
            if cache_hit:
                agg.cache_hits += 1
                agg.cache_savings += estimated_cost
            agg.save()
            return log
    except Exception as exc:
        logger.error("Failed to log usage: %s", exc, exc_info=True)
        return None
