import logging
from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

RATE_LIMIT_LIMITS = {
    "free": 10,
    "pro": 60,
    "enterprise": 300,
}


class RateLimitExceeded(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Rate limit exceeded."
    default_code = "rate_limit_exceeded"


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.public_paths = {"/api/health/", "/api/auth/login/", "/api/auth/register/", "/api/docs/", "/api/schema/", "/api/redoc/"}

    def __call__(self, request):
        if request.path in self.public_paths:
            return self.get_response(request)

        if not request.path.startswith("/api/"):
            return self.get_response(request)

        organization = getattr(request, "organization", None)
        api_key = getattr(request, "api_key", None)
        api_key_id = api_key.id if api_key else None

        if organization:
            plan_name = (organization.plan.name or "free").lower().strip()
            effective_limit = RATE_LIMIT_LIMITS.get(plan_name, 10)
            if api_key and api_key.rate_limit_override is not None:
                effective_limit = api_key.rate_limit_override
        elif api_key:
            effective_limit = api_key.rate_limit_override or 10
        else:
            effective_limit = 10

        try:
            from middleware.redis_utils import check_rate_limit
            allowed, remaining, reset_time = check_rate_limit(
                str(organization.id) if organization else "anonymous",
                str(api_key_id) if api_key_id else None,
                effective_limit,
            )
        except Exception as exc:
            logger.debug("Rate limiter Redis error: %s", exc)
            return self.get_response(request)

        response = self.get_response(request)

        if not allowed:
            exc = RateLimitExceeded(f"Rate limit exceeded. Retry after {reset_time}.")
            response = JsonResponse(
                {
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": str(exc.detail),
                        "request_id": getattr(request, "request_id", None),
                    }
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            response["Retry-After"] = str(reset_time)
            return response

        response["X-RateLimit-Limit"] = str(effective_limit)
        response["X-RateLimit-Remaining"] = str(max(0, remaining))
        response["X-RateLimit-Reset"] = str(reset_time)
        return response
