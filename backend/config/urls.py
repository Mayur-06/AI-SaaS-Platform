from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from common.core.views import PublicHealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/org/", include("accounts.org_urls")),
    path("api/keys/", include("billing.urls")),
    path("api/billing/", include("billing.billing_urls")),
    path("api/ai/", include("ai_service.urls")),
    path("api/cache/", include("ai_service.cache_urls")),
    path("api/admin/", include("common.core.admin_urls")),
    path("api/health/", PublicHealthView.as_view(), name="public-health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
]

handler404 = "common.core.views.custom_404_view"
handler500 = "common.core.views.custom_500_view"

