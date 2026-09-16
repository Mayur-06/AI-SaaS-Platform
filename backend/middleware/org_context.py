import logging

logger = logging.getLogger(__name__)


class OrganizationContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        organization = None
        user = getattr(request, "user", None)

        if not (user and user.is_authenticated):
            auth_header = request.headers.get("Authorization", "")
            token = None
            if auth_header.startswith("Bearer "):
                token_val = auth_header.split(" ", 1)[1].strip()
                if token_val.startswith("sk_live_"):
                    try:
                        from billing.models import APIKey
                        api_key = APIKey.verify_key(token_val, None)
                        if api_key:
                            request.api_key = api_key
                            organization = api_key.organization
                            owner_membership = organization.memberships.filter(role="owner", is_active=True).first()
                            if owner_membership:
                                user = owner_membership.user
                                request.user = user
                    except Exception as exc:
                        logger.debug("Middleware Bearer API key auth failed: %s", exc)
                else:
                    token = token_val
            elif auth_header.startswith("ApiKey "):
                raw_key = auth_header.split(" ", 1)[1].strip()
                try:
                    from billing.models import APIKey
                    api_key = APIKey.verify_key(raw_key, None)
                    if api_key:
                        request.api_key = api_key
                        organization = api_key.organization
                        owner_membership = organization.memberships.filter(role="owner", is_active=True).first()
                        if owner_membership:
                            user = owner_membership.user
                            request.user = user
                except Exception as exc:
                    logger.debug("Middleware ApiKey auth failed: %s", exc)
            elif "access_token" in request.COOKIES:
                token = request.COOKIES["access_token"]

            if token:
                try:
                    from rest_framework_simplejwt.tokens import AccessToken
                    from accounts.models import User
                    validated_token = AccessToken(token)
                    user_id = validated_token.get("user_id")
                    if user_id:
                        found_user = User.objects.filter(id=user_id, is_active=True).first()
                        if found_user:
                            user = found_user
                            request.user = user
                except Exception as exc:
                    logger.debug("Middleware JWT auth failed: %s", exc)

        if not organization and user and user.is_authenticated:
            membership = user.memberships.filter(is_active=True, organization__is_active=True).select_related("organization", "organization__plan").first()
            if membership:
                organization = membership.organization

        request.organization = organization
        return self.get_response(request)

