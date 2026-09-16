from django.urls import path, include
from rest_framework.routers import DefaultRouter
from accounts.views import MemberViewSet, InvitationViewSet, OrganizationView, TransferOwnershipView, OrganizationDeleteView

router = DefaultRouter()
router.register(r"members", MemberViewSet, basename="members")
router.register(r"invite", InvitationViewSet, basename="invitations")

urlpatterns = [
    path("", OrganizationView.as_view(), name="organization-detail"),
    path("transferownership/", TransferOwnershipView.as_view(), name="organization-transfer-ownership"),
    path("transfer-ownership/", TransferOwnershipView.as_view(), name="organization-transfer-ownership-hyphen"),
    path("delete/", OrganizationDeleteView.as_view(), name="organization-delete-explicit"),
    path("", include(router.urls)),
]

