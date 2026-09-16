from django.urls import path
from billing.views import (
    BillingPlanView, BillingUpgradeView, BillingUsageView, BillingUsageExportView,
)

urlpatterns = [
    path("plan/", BillingPlanView.as_view(), name="billing-plan"),
    path("upgrade/", BillingUpgradeView.as_view(), name="billing-upgrade"),
    path("usage/", BillingUsageView.as_view(), name="billing-usage"),
    path("usage/export/", BillingUsageExportView.as_view(), name="billing-usage-export"),
]
