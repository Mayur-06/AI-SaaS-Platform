from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.authentication import get_authorization_header, BaseAuthentication
from rest_framework import exceptions
import logging

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get("access_token")
        if raw_token is None:
            return None
        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            if user and not getattr(request, "organization", None):
                membership = user.memberships.filter(is_active=True).select_related("organization", "organization__plan").first()
                if membership:
                    request.organization = membership.organization
            return user, validated_token
        except (InvalidToken, TokenError) as exc:
            logger.debug("Cookie JWT auth failed: %s", exc)
            return None


class BearerJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = get_authorization_header(request)
        if not header:
            return None
        prefix, _, token = header.partition(b" ")
        if prefix.lower() != b"bearer":
            return None
        if token.startswith(b"sk_live_"):
            return None
        try:
            validated_token = self.get_validated_token(token)
            user = self.get_user(validated_token)
            if user and not getattr(request, "organization", None):
                membership = user.memberships.filter(is_active=True).select_related("organization", "organization__plan").first()
                if membership:
                    request.organization = membership.organization
            return user, validated_token
        except (InvalidToken, TokenError) as exc:
            logger.debug("Bearer JWT auth failed: %s", exc)
            return None


class APIKeyAuthentication(BaseAuthentication):
    keyword = "ApiKey"

    def authenticate(self, request):
        raw_key = None
        auth = get_authorization_header(request).split()
        if auth:
            prefix = auth[0].lower()
            if prefix == self.keyword.lower().encode() or (prefix == b"bearer" and len(auth) >= 2 and auth[1].startswith(b"sk_live_")):
                if len(auth) == 1:
                    raise exceptions.AuthenticationFailed("Invalid API key header. No credentials provided.")
                if len(auth) > 2:
                    raise exceptions.AuthenticationFailed("Invalid API key header. Token string should not contain spaces.")
                try:
                    raw_key = auth[1].decode()
                except UnicodeDecodeError:
                    raise exceptions.AuthenticationFailed("Invalid API key encoding.")

        # Also support standard X-API-Key header for external API clients
        if not raw_key:
            x_api_key = request.META.get("HTTP_X_API_KEY")
            if x_api_key:
                raw_key = x_api_key.strip()

        if not raw_key:
            return None

        from billing.models import APIKey
        api_key = APIKey.verify_key(raw_key, None)
        if not api_key:
            raise exceptions.AuthenticationFailed("Invalid or inactive API key.")
        request.api_key = api_key
        request.organization = api_key.organization
        owner_membership = api_key.organization.memberships.filter(role="owner", is_active=True).first()
        return (owner_membership.user if owner_membership else None, api_key)

