from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.authentication import get_authorization_header
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
            return self.get_user(validated_token), validated_token
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
        try:
            validated_token = self.get_validated_token(token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError) as exc:
            logger.debug("Bearer JWT auth failed: %s", exc)
            raise exceptions.AuthenticationFailed(str(exc)) from exc


class APIKeyAuthentication:
    keyword = "ApiKey"

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != self.keyword.lower().encode():
            return None
        if len(auth) == 1:
            raise exceptions.AuthenticationFailed("Invalid API key header. No credentials provided.")
        if len(auth) > 2:
            raise exceptions.AuthenticationFailed("Invalid API key header. Token string should not contain spaces.")
        raw_key = auth[1].decode()
        from billing.models import APIKey
        api_key = APIKey.verify_key(raw_key, None)
        if not api_key:
            raise exceptions.AuthenticationFailed("Invalid or inactive API key.")
        request.api_key = api_key
        request.organization = api_key.organization
        owner_membership = api_key.organization.memberships.filter(role="owner", is_active=True).first()
        return (owner_membership.user if owner_membership else None, api_key)
