import logging

logger = logging.getLogger(__name__)


class OrganizationContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        organization = None
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            membership = user.memberships.filter(is_active=True).select_related("organization").first()
            if membership:
                organization = membership.organization

        request.organization = organization
        return self.get_response(request)
