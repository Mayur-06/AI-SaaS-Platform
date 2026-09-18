import uuid
import time
import logging
import django
from django.conf import settings
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
                provider_status = {"status": "unknown", "model": mc.name, "provider": mc.provider}
                try:
                    start = time.time()
                    if mc.provider == "gemini":
                        if not getattr(settings, "GEMINI_API_KEY", ""):
                            provider_status["status"] = "not_configured"
                            provider_status["error"] = "GEMINI_API_KEY not configured"
                        else:
                            import google.generativeai as genai
                            genai.configure(api_key=settings.GEMINI_API_KEY)
                            model = genai.GenerativeModel(mc.name)
                            model.generate_content("hi", generation_config=genai.GenerationConfig(max_output_tokens=1))
                            provider_status["status"] = "healthy"
                            provider_status["latency_ms"] = round((time.time() - start) * 1000, 1)
                    elif mc.provider == "openai":
                        if not getattr(settings, "OPENAI_API_KEY", ""):
                            provider_status["status"] = "not_configured"
                            provider_status["error"] = "OPENAI_API_KEY not configured"
                        else:
                            from openai import OpenAI
                            client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=3.0, max_retries=0)
                            client.chat.completions.create(
                                model=mc.name,
                                messages=[{"role": "user", "content": "hi"}],
                                max_tokens=1,
                            )
                            provider_status["status"] = "healthy"
                            provider_status["latency_ms"] = round((time.time() - start) * 1000, 1)
                    elif mc.provider == "anthropic":
                        if not getattr(settings, "ANTHROPIC_API_KEY", ""):
                            provider_status["status"] = "not_configured"
                            provider_status["error"] = "ANTHROPIC_API_KEY not configured"
                        else:
                            from anthropic import Anthropic
                            client = Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=3.0, max_retries=0)
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
        all_healthy = (
            checks.get("database", {}).get("status") == "healthy"
            and checks.get("redis", {}).get("status") == "healthy"
        )
        checks["status"] = "healthy" if all_healthy else "degraded"
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
        revenue_estimate = Organization.objects.filter(
            is_active=True, plan__isnull=False
        ).aggregate(
            total=Sum("plan__price")
        )["total"] or 0

        return JsonResponse({
            "total_organizations": total_orgs,
            "total_users": total_users,
            "requests_today": requests_today,
            "requests_this_month": requests_month,
            "requests_month": requests_month,
            "monthly_cost_estimate": round(monthly_cost, 4),
            "platform_cost": round(monthly_cost, 4),
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
                "plan": {"name": org.plan.name} if org.plan else {"name": "Free"},
                "member_count": member_count,
                "monthly_requests": monthly_requests,
                "monthly_cost": round(monthly_cost, 4),
                "is_active": org.is_active,
                "created_at": org.created_at.isoformat(),
            })
        return JsonResponse({
            "count": len(result),
            "results": result,
            "tenants": result,
        })


class AdminRoutingView(APIView):
    def get_permissions(self):
        from common.core.permissions import IsSuperAdmin
        return [IsSuperAdmin()]

    PLAN_PERMITTED_MODELS = {
        "free": ["gemini-2.5-flash"],
        "pro": ["gemini-2.5-flash", "gpt-4o-mini"],
        "enterprise": ["gemini-2.5-flash", "gpt-4o-mini", "gpt-4"],
    }

    def get(self, request):
        from billing.models import Plan, ModelConfig, RoutingRule

        plans = [{"id": str(p.id), "name": p.name} for p in Plan.objects.all()]
        models = [
            {
                "id": str(m.id),
                "name": m.name,
                "provider": m.provider,
                "is_active": m.is_active,
                "input_cost_per_1k": str(m.input_cost_per_1k),
                "output_cost_per_1k": str(m.output_cost_per_1k),
            }
            for m in ModelConfig.objects.all()
        ]

        rules = []
        for r in RoutingRule.objects.select_related("plan", "primary_model").prefetch_related("fallback_models").all():
            rules.append({
                "id": str(r.id),
                "plan_name": r.plan.name,
                "plan_id": str(r.plan.id),
                "primary_model": {
                    "id": str(r.primary_model.id),
                    "name": r.primary_model.name,
                    "provider": r.primary_model.provider,
                },
                "fallback_models": [
                    {
                        "id": str(fb.id),
                        "name": fb.name,
                        "provider": fb.provider,
                    }
                    for fb in r.fallback_models.all()
                ],
                "timeout_seconds": r.timeout_seconds,
            })

        return JsonResponse({
            "plans": plans,
            "models": models,
            "rules": rules,
            "permitted_models": self.PLAN_PERMITTED_MODELS,
        })

    def post(self, request):
        from billing.models import Plan, ModelConfig, RoutingRule

        plan_name = request.data.get("plan_name")
        primary_model_id = request.data.get("primary_model_id")
        fallback_model_ids = request.data.get("fallback_model_ids", [])
        timeout_seconds = int(request.data.get("timeout_seconds", 10))

        if not plan_name or not primary_model_id:
            return JsonResponse({"error": "plan_name and primary_model_id are required."}, status=400)

        plan = Plan.objects.filter(name=plan_name.lower()).first()
        if not plan:
            return JsonResponse({"error": f"Plan '{plan_name}' does not exist."}, status=404)

        primary_model = ModelConfig.objects.filter(id=primary_model_id).first()
        if not primary_model:
            return JsonResponse({"error": "Primary model does not exist."}, status=404)

        if not primary_model.is_active:
            return JsonResponse({"error": f"Model '{primary_model.name}' is inactive and cannot be assigned."}, status=400)

        allowed = self.PLAN_PERMITTED_MODELS.get(plan.name.lower(), [])
        if allowed and primary_model.name not in allowed:
            return JsonResponse({
                "error": f"Model '{primary_model.name}' is not permitted for the '{plan.name.capitalize()}' tier. Permitted models: {', '.join(allowed)}."
            }, status=400)

        fallbacks = []
        for f_id in fallback_model_ids:
            fb = ModelConfig.objects.filter(id=f_id).first()
            if not fb:
                return JsonResponse({"error": f"Fallback model ID '{f_id}' does not exist."}, status=404)
            if not fb.is_active:
                return JsonResponse({"error": f"Fallback model '{fb.name}' is inactive."}, status=400)
            fallbacks.append(fb)

        rule = RoutingRule.objects.filter(plan=plan).first()
        if not rule:
            rule = RoutingRule(plan=plan, primary_model=primary_model)
        else:
            rule.primary_model = primary_model
        rule.timeout_seconds = max(1, min(timeout_seconds, 60))
        rule.save()
        rule.fallback_models.set(fallbacks)

        return JsonResponse({
            "message": f"Routing configuration for {plan.name.capitalize()} updated successfully.",
            "rule": {
                "id": str(rule.id),
                "plan_name": rule.plan.name,
                "primary_model": {"id": str(rule.primary_model.id), "name": rule.primary_model.name},
                "fallback_models": [{"id": str(f.id), "name": f.name} for f in rule.fallback_models.all()],
                "timeout_seconds": rule.timeout_seconds,
            }
        })
