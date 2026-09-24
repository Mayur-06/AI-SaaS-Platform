import logging
from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class MonthlyLimitExceeded(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Monthly request limit exceeded. Upgrade to Pro for 5,000 requests/month at /billing."
    default_code = "monthly_limit_exceeded"


class UsageLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not (request.path.startswith("/api/ai/query") and request.method == "POST"):
            return self.get_response(request)

        organization = getattr(request, "organization", None)
        if not organization or not getattr(organization, "plan", None):
            return self.get_response(request)

        if organization.plan.name.lower() == "enterprise":
            return self.get_response(request)

        from billing.models import UsageAggregate
        from django.utils import timezone
        from django.db.models import F
        from django.db import transaction

        now = timezone.now()
        month_str = now.strftime("%Y-%m")
        monthly_limit = organization.plan.monthly_request_limit

        try:
            with transaction.atomic():
                agg, _ = UsageAggregate.objects.select_for_update().get_or_create(
                    organization=organization,
                    month=month_str,
                    defaults={"date": now.date(), "total_requests": 0},
                )
                if agg.total_requests >= monthly_limit:
                    remaining = max(0, monthly_limit - agg.total_requests)
                    upgrade_url = "/api/billing/upgrade/"
                    upgrade_link = "/billing"
                    response = JsonResponse(
                        {
                            "error": {
                                "code": "MONTHLY_LIMIT_EXCEEDED",
                                "message": f"Monthly limit of {monthly_limit} requests reached. Upgrade to Pro for 5,000 requests/month at {upgrade_link}.",
                                "monthly_limit": monthly_limit,
                                "requests_used": agg.total_requests,
                                "remaining": remaining,
                                "upgrade_url": upgrade_url,
                                "upgrade_link": upgrade_link,
                                "request_id": getattr(request, "request_id", None),
                            },
                            "upgrade_url": upgrade_url,
                            "upgrade_link": upgrade_link,
                        },
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                    response["X-Usage-Warning"] = "limit_reached"
                    return response
                if agg.total_requests >= int(monthly_limit * 0.8):
                    request.META["X-USAGE-WARNING"] = "approaching_limit"
        except Exception as exc:
            logger.warning("Usage limit check failed: %s", exc, exc_info=True)

        response = self.get_response(request)
        if getattr(request, "META", {}).get("X-USAGE-WARNING") == "approaching_limit":
            response["X-Usage-Warning"] = "approaching_limit"
        return response
