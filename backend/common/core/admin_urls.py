from django.urls import path
from common.core.views import PublicHealthView, AdminHealthView, AdminUsageView, AdminTenantsView

urlpatterns = [
    path("health/", PublicHealthView.as_view(), name="public-health"),
    path("tenants/", AdminTenantsView.as_view(), name="admin-tenants"),
    path("usage/", AdminUsageView.as_view(), name="admin-usage"),
    path("health/detailed/", AdminHealthView.as_view(), name="admin-health"),
]
