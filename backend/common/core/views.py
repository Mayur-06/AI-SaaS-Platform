import uuid
import logging
import django
from django.db import connection
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)


class PublicHealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            db_status = "healthy"
        except Exception as exc:
            logger.warning("Database health check failed: %s", exc)
            db_status = "unhealthy"

        return JsonResponse({
            "status": "ok" if db_status == "healthy" else "degraded",
            "django_version": django.get_version(),
            "database": db_status,
        })


class AdminHealthView(APIView):
    permission_classes = []

    def get_permissions(self):
        from common.core.permissions import IsSuperAdmin
        return [IsSuperAdmin()]

    def get(self, request):
        request_id = getattr(request, "request_id", str(uuid.uuid4()))
        checks = {"request_id": request_id}

        try:
            connection.ensure_connection()
            checks["database"] = {"status": "healthy", "latency_ms": None}
        except Exception as exc:
            checks["database"] = {"status": "unhealthy", "error": str(exc)}

        try:
            from django.core.cache import cache
            cache.set("health_check", "ok", 10)
            cache.get("health_check")
            checks["redis"] = {"status": "healthy"}
        except Exception as exc:
            checks["redis"] = {"status": "unhealthy", "error": str(exc)}

        providers = {}
        try:
            from ai_service.services.model_router import ModelRouter
            router = ModelRouter(getattr(request, "organization", None))
            for mc in router.configs.filter(is_active=True):
                provider_status = {"status": "unknown", "model": mc.name}
                try:
                    start = time.time()
                    if mc.provider == "gemini":
                        import google.generativeai as genai
                        genai.configure(api_key=settings.GEMINI_API_KEY)
                        model = genai.GenerativeModel(mc.name)
                        model.generate_content("hi", generation_config=genai.GenerationConfig(max_output_tokens=1))
                    elif mc.provider == "openai":
                        from openai import OpenAI
                        client = OpenAI(api_key=settings.OPENAI_API_KEY)
                        client.chat.completions.create(
                            model=mc.name,
                            messages=[{"role": "user", "content": "hi"}],
                            max_tokens=1,
                        )
                    elif mc.provider == "anthropic":
                        from anthropic import Anthropic
                        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                        client.messages.create(
                            model=mc.name,
                            system="hi",
                            messages=[{"role": "user", "content": "hi"}],
                            max_tokens=1,
                        )
                    provider_status["status"] = "healthy"
                    provider_status["latency_ms"] = round((time.time() - start) * 1000, 1)
                except Exception as exc:
                    provider_status["status"] = "unhealthy"
                    provider_status["error"] = str(exc)
                providers[mc.name] = provider_status
        except Exception as exc:
            providers["error"] = str(exc)

        checks["providers"] = providers
        return JsonResponse(checks)


class AdminUsageView(APIView):
    def get_permissions(self):
        from common.core.permissions import IsSuperAdmin
        return [IsSuperAdmin()]

    def get(self, request):
        from accounts.models import Organization, User, Membership
        from billing.models import UsageLog, Plan
        from django.db.models import Sum, Count
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.now().date()
        month_start = today.replace(day=1)

        total_orgs = Organization.objects.filter(is_active=True).count()
        total_users = User.objects.filter(is_active=True).count()
        requests_today = UsageLog.objects.filter(timestamp__date=today).count()
        requests_month = UsageLog.objects.filter(timestamp__date__gte=month_start).count()
        monthly_cost = UsageLog.objects.filter(
            timestamp__date__gte=month_start
        ).aggregate(total=Sum("estimated_cost"))["total"] or 0
        cache_hits = UsageLog.objects.filter(timestamp__date__gte=month_start, cache_hit=True).count()
        cache_hit_rate = (cache_hits / requests_month * 100) if requests_month > 0 else 0
        revenue_estimate = Plan.objects.filter(
            organization__is_active=True
        ).annotate(org_count=Count("organization")).aggregate(
            total=Sum("price")
        )["total"] or 0

        return JsonResponse({
            "total_organizations": total_orgs,
            "total_users": total_users,
            "requests_today": requests_today,
            "requests_this_month": requests_month,
            "monthly_cost_estimate": round(monthly_cost, 4),
            "cache_hit_rate_percent": round(cache_hit_rate, 2),
            "revenue_estimate": round(revenue_estimate, 2),
        })


class AdminTenantsView(APIView):
    def get_permissions(self):
        from common.core.permissions import IsSuperAdmin
        return [IsSuperAdmin()]

    def get(self, request):
        from accounts.models import Organization, Membership
        from billing.models import UsageLog, Plan
        from django.db.models import Count, Sum, Q
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.now().date()
        month_start = today.replace(day=1)

        orgs = Organization.objects.filter(is_active=True).select_related("plan")
        result = []
        for org in orgs:
            member_count = Membership.objects.filter(organization=org, is_active=True).count()
            monthly_requests = UsageLog.objects.filter(
                organization=org, timestamp__date__gte=month_start
            ).count()
            monthly_cost = UsageLog.objects.filter(
                organization=org, timestamp__date__gte=month_start
            ).aggregate(total=Sum("estimated_cost"))["total"] or 0
            result.append({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "plan": org.plan.name if org.plan else None,
                "member_count": member_count,
                "monthly_requests": monthly_requests,
                "monthly_cost": round(monthly_cost, 4),
                "is_active": org.is_active,
                "created_at": org.created_at.isoformat(),
            })
        return JsonResponse({"tenants": result})
