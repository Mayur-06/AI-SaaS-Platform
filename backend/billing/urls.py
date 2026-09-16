from django.urls import path, include
from rest_framework.routers import DefaultRouter
from billing.views import APIKeyViewSet

router = DefaultRouter()
router.register(r"", APIKeyViewSet, basename="apikeys")

urlpatterns = [
    path("", include(router.urls)),
]
