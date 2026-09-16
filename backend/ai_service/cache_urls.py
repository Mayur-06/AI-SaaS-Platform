from django.urls import path
from ai_service.views import CacheStatsView, CacheClearView, CacheThresholdView

urlpatterns = [
    path("stats/", CacheStatsView.as_view(), name="cache-stats"),
    path("clear/", CacheClearView.as_view(), name="cache-clear"),
    path("threshold/", CacheThresholdView.as_view(), name="cache-threshold"),
]
