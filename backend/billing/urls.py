from django.urls import path, include
from rest_framework.routers import DefaultRouter
from billing.views import (
    BillingPlanView, BillingUpgradeView, BillingUsageView, BillingUsageExportView,
    APIKeyViewSet, InvoiceViewSet,
)

router = DefaultRouter()
router.register(r"keys", APIKeyViewSet, basename="apikeys")
router.register(r"invoices", InvoiceViewSet, basename="invoices")

urlpatterns = [
    path("", include(router.urls)),
]
