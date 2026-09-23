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

TPM_LIMITS = {
    "free": 10_000,
    "pro": 100_000,
    "enterprise": 1_000_000,
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

        user = getattr(request, "user", None)
        if user and user.is_authenticated and user.is_staff:
            return self.get_response(request)

        organization = getattr(request, "organization", None)
        api_key = getattr(request, "api_key", None)
        api_key_id = api_key.id if api_key else None

        plan_name = (organization.plan.name or "free").lower().strip() if organization and organization.plan else "free"
        if organization:
            plan_limit = getattr(organization.plan, "requests_per_minute", None) or RATE_LIMIT_LIMITS.get(plan_name, 60)
            if api_key:
                effective_limit = api_key.rate_limit_override if api_key.rate_limit_override is not None else plan_limit
            else:
                effective_limit = plan_limit
        elif api_key:
            effective_limit = api_key.rate_limit_override or 60
        else:
            effective_limit = 60

        tpm_limit = TPM_LIMITS.get(plan_name, 10_000)

        # 1. Check Requests Per Minute (RPM)
        try:
            from middleware.redis_utils import check_rate_limit, check_token_rate_limit
            allowed, remaining, reset_time = check_rate_limit(
                str(organization.id) if organization else "anonymous",
                str(api_key_id) if api_key_id else None,
                effective_limit,
            )
        except Exception as exc:
            logger.debug("Rate limiter Redis error: %s", exc)
            return self.get_response(request)

        if not allowed:
            import time
            retry_after = max(1, reset_time - int(time.time()))
            exc = RateLimitExceeded(f"Rate limit exceeded. Retry after {retry_after}s.")
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
            response["Retry-After"] = str(retry_after)
            response["X-RateLimit-Limit"] = str(effective_limit)
            response["X-RateLimit-Remaining"] = "0"
            response["X-RateLimit-Reset"] = str(reset_time)
            return response

        # 2. Check Tokens Per Minute (TPM) for AI consumption endpoints
        token_rem = tpm_limit
        token_reset = reset_time
        if organization:
            try:
                allowed_tokens, token_rem, token_reset, _ = check_token_rate_limit(
                    str(organization.id),
                    str(api_key_id) if api_key_id else None,
                    tpm_limit,
                )
                if not allowed_tokens and request.path.startswith("/api/ai/"):
                    import time
                    retry_after = max(1, token_reset - int(time.time()))
                    response = JsonResponse(
                        {
                            "error": {
                                "code": "TOKEN_RATE_LIMIT_EXCEEDED",
                                "message": f"Token rate limit (TPM) exceeded. Limit: {tpm_limit} tokens/min. Retry after {retry_after}s.",
                                "request_id": getattr(request, "request_id", None),
                            }
                        },
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                    response["Retry-After"] = str(retry_after)
                    response["X-RateLimit-Limit"] = str(effective_limit)
                    response["X-RateLimit-Remaining"] = str(max(0, remaining))
                    response["X-RateLimit-Reset"] = str(reset_time)
                    response["X-RateLimit-Limit-Tokens"] = str(tpm_limit)
                    response["X-RateLimit-Remaining-Tokens"] = "0"
                    response["X-RateLimit-Reset-Tokens"] = str(token_reset)
                    return response
            except Exception as exc:
                logger.debug("TPM check error: %s", exc)

        response = self.get_response(request)
        response["X-RateLimit-Limit"] = str(effective_limit)
        response["X-RateLimit-Remaining"] = str(max(0, remaining))
        response["X-RateLimit-Reset"] = str(reset_time)
        if organization:
            response["X-RateLimit-Limit-Tokens"] = str(tpm_limit)
            response["X-RateLimit-Remaining-Tokens"] = str(max(0, token_rem))
            response["X-RateLimit-Reset-Tokens"] = str(token_reset)
        return response
