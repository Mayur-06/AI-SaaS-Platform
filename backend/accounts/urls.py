from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import (
    AuthRegisterView, AuthLoginView, AuthPasswordResetView, AuthPasswordResetConfirmView,
    AuthVerifyView, MemberViewSet, InvitationViewSet,
)

urlpatterns = [
    path("register/", AuthRegisterView.as_view(), name="auth-register"),
    path("login/", AuthLoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("password-reset/", AuthPasswordResetView.as_view(), name="auth-password-reset"),
    path("password-reset/confirm/", AuthPasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("verify/<str:token>/", AuthVerifyView.as_view(), name="auth-verify"),
]
