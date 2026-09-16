from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler
import logging
import uuid

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    request = context.get("request")
    request_id = getattr(request, "request_id", str(uuid.uuid4()))

    if response is not None:
        error_code = _get_error_code(exc)
        response.data = {
            "error": {
                "code": error_code,
                "message": response.data.get("detail", str(exc)),
                "request_id": request_id,
            }
        }
        response.status_code = status.HTTP_400_BAD_REQUEST if status.is_server_error(response.status_code) else response.status_code
    else:
        logger.exception("Unhandled exception: %s", exc, extra={"request_id": request_id})
        response = Response(
            {
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred.",
                    "request_id": request_id,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def _get_error_code(exc):
    code_map = {
        "NotAuthenticated": "AUTHENTICATION_FAILED",
        "AuthenticationFailed": "AUTHENTICATION_FAILED",
        "InvalidAPIKey": "INVALID_API_KEY",
        "PermissionDenied": "PERMISSION_DENIED",
        "MonthlyLimitExceeded": "MONTHLY_LIMIT_EXCEEDED",
        "RateLimitExceeded": "RATE_LIMIT_EXCEEDED",
        "ModelUnavailable": "MODEL_UNAVAILABLE",
    }
    return code_map.get(exc.__class__.__name__, "VALIDATION_ERROR")
