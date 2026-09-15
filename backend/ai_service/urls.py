from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ai_service.views import (
    DocumentViewSet, AIQueryView, AIHistoryView,
    CacheStatsView, CacheClearView, CacheThresholdView,
)

router = DefaultRouter()
router.register(r"documents", DocumentViewSet, basename="documents")

urlpatterns = [
    path("query/", AIQueryView.as_view(), name="ai-query"),
    path("history/", AIHistoryView.as_view(), name="ai-history"),
    path("", include(router.urls)),
]
