from django.urls import path, include
from rest_framework.routers import DefaultRouter
from billing.views import (
    BillingPlanView, BillingUpgradeView, BillingUsageView, BillingUsageExportView,
    InvoiceViewSet,
)

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet, basename="invoices")

urlpatterns = [
    path("", include(router.urls)),
    path("plan/", BillingPlanView.as_view(), name="billing-plan"),
    path("upgrade/", BillingUpgradeView.as_view(), name="billing-upgrade"),
    path("usage/", BillingUsageView.as_view(), name="billing-usage"),
    path("usage/export/", BillingUsageExportView.as_view(), name="billing-usage-export"),
]
