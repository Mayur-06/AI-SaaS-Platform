from django.urls import path
from common.core.views import AdminHealthView, AdminUsageView, AdminTenantsView

urlpatterns = [
    path("tenants/", AdminTenantsView.as_view(), name="admin-tenants"),
    path("usage/", AdminUsageView.as_view(), name="admin-usage"),
    path("health/", AdminHealthView.as_view(), name="admin-health"),
]
