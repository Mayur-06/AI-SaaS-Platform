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
            from decimal import Decimal
            cost_dec = Decimal(str(round(float(estimated_cost or 0), 6)))

            log = UsageLog.objects.create(
                organization=organization,
                user=user,
                api_key=api_key,
                endpoint=endpoint,
                model_used=model_used,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
                estimated_cost=cost_dec,
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
            agg.total_requests = (agg.total_requests or 0) + 1
            agg.input_tokens = (agg.input_tokens or 0) + input_tokens
            agg.output_tokens = (agg.output_tokens or 0) + output_tokens
            agg.total_cost = (agg.total_cost or Decimal("0")) + cost_dec
            if cache_hit:
                agg.cache_hits = (agg.cache_hits or 0) + 1
                # Savings calculated per 10,000 output tokens avoided ($0.02 per 10k tokens)
                SAVED_RATE_PER_10K = 0.02
                saved_cost = Decimal(str(round((max(output_tokens, 30) / 10000.0) * SAVED_RATE_PER_10K, 6)))
                agg.cache_savings = (agg.cache_savings or Decimal("0")) + saved_cost
            agg.save()

            # Record tokens into Redis for sliding-window TPM rate limiting
            total_toks = (input_tokens or 0) + (output_tokens or 0)
            if total_toks > 0 and organization:
                try:
                    from middleware.redis_utils import record_token_usage
                    record_token_usage(
                        str(organization.id),
                        str(api_key.id) if api_key else None,
                        total_toks,
                    )
                except Exception as rec_exc:
                    logger.debug("Failed to record token usage in Redis TPM: %s", rec_exc)

            return log
    except Exception as exc:
        logger.error("Failed to log usage: %s", exc, exc_info=True)
        return None
