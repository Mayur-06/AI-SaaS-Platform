import logging
import csv
import io
from datetime import date, timedelta
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum, Count, Q, F
from billing.models import Plan, APIKey, Invoice, UsageLog, UsageAggregate, ModelConfig, RoutingRule
from billing.serializers import (
    PlanSerializer, APIKeySerializer, InvoiceSerializer, UsageLogSerializer,
    UsageAggregateSerializer, ModelConfigSerializer, RoutingRuleSerializer, UsageExportSerializer,
)
from common.core.permissions import IsAuthenticatedAndActive, IsAdminOrOwner
from accounts.models import Membership

logger = logging.getLogger(__name__)


def get_request_org(request):
    org = getattr(request, "organization", None)
    if org:
        return org
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        membership = user.memberships.filter(is_active=True).select_related("organization", "organization__plan").first()
        if membership:
            return membership.organization
    return None


def ensure_default_plans():
    Plan.objects.get_or_create(
        name=Plan.PLAN_FREE,
        defaults={"monthly_request_limit": 100, "requests_per_minute": 10, "price": 0, "cache_ttl_seconds": 3600},
    )
    Plan.objects.get_or_create(
        name=Plan.PLAN_PRO,
        defaults={"monthly_request_limit": 1000, "requests_per_minute": 60, "price": 29, "cache_ttl_seconds": 86400},
    )
    Plan.objects.get_or_create(
        name=Plan.PLAN_ENTERPRISE,
        defaults={"monthly_request_limit": 999999, "requests_per_minute": 300, "price": 99, "cache_ttl_seconds": 604800},
    )


class BillingPlanView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        ensure_default_plans()
        serializer = PlanSerializer(org.plan) if org.plan else None
        plans = Plan.objects.all().order_by("price")
        data = {
            "current_plan": serializer.data if serializer else None,
            "plans": PlanSerializer(plans, many=True).data,
        }
        if serializer:
            data.update(serializer.data)
        return Response(data)

    @extend_schema(request={"type": "object", "properties": {"plan": {"type": "string"}}, "required": ["plan"]}, responses=PlanSerializer)
    def post(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        user = getattr(request, "user", None)
        if user and not user.memberships.filter(organization=org, role__in=["owner", "admin"], is_active=True).exists():
            return Response({"detail": "Insufficient permissions to change plan."}, status=status.HTTP_403_FORBIDDEN)
        new_plan_name = request.data.get("plan")
        plan_id = request.data.get("plan_id")
        new_plan = None
        if plan_id:
            try:
                new_plan = Plan.objects.get(id=plan_id)
            except (Plan.DoesNotExist, ValueError):
                pass
        if not new_plan and new_plan_name:
            try:
                new_plan = Plan.objects.get(name__iexact=new_plan_name)
            except Plan.DoesNotExist:
                pass
        if not new_plan:
            return Response({"detail": "Valid plan or plan_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        org.plan = new_plan
        org.save(update_fields=["plan"])
        return Response(PlanSerializer(org.plan).data)


class BillingUpgradeView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    @transaction.atomic
    @extend_schema(request={"type": "object", "properties": {"plan": {"type": "string"}}, "required": ["plan"]}, responses=PlanSerializer)
    def post(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        new_plan_name = request.data.get("plan")
        plan_id = request.data.get("plan_id")
        new_plan = None
        if plan_id:
            try:
                new_plan = Plan.objects.get(id=plan_id)
            except (Plan.DoesNotExist, ValueError):
                pass
        if not new_plan and new_plan_name:
            try:
                new_plan = Plan.objects.get(name__iexact=new_plan_name)
            except Plan.DoesNotExist:
                pass
        if not new_plan:
            return Response({"detail": "Valid plan or plan_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        org.plan = new_plan
        org.save(update_fields=["plan"])
        return Response({
            "current_plan": PlanSerializer(new_plan).data,
            **PlanSerializer(new_plan).data,
        })


class BillingUsageView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        plan = org.plan
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_logs = UsageLog.objects.filter(organization=org, timestamp__gte=month_start)
        requests_used = month_logs.count()
        monthly_limit = plan.monthly_request_limit if plan else 100
        input_tokens = month_logs.aggregate(total=Sum("input_tokens"))["total"] or 0
        output_tokens = month_logs.aggregate(total=Sum("output_tokens"))["total"] or 0
        total_cost = month_logs.aggregate(total=Sum("estimated_cost"))["total"] or 0
        remaining = max(0, monthly_limit - requests_used)
        usage_percent = (requests_used / monthly_limit * 100) if monthly_limit > 0 else 0
        budget_remaining = max(0.0, float(org.monthly_budget) - float(total_cost))
        days_passed = max(1, (now - month_start).days + 1)
        projected_spend = (float(total_cost) / days_passed) * 30

        cache_hits = month_logs.filter(cache_hit=True).count()
        cache_hit_rate = round((cache_hits / requests_used * 100), 2) if requests_used > 0 else 0
        month_str = now.strftime("%Y-%m")
        agg = UsageAggregate.objects.filter(organization=org, month=month_str).first()
        if agg and agg.cache_savings:
            cache_savings = agg.cache_savings
        else:
            cached_output_tokens = month_logs.filter(cache_hit=True).aggregate(total=Sum("output_tokens"))["total"] or 0
            cache_savings = round(cached_output_tokens * 0.000002, 4)

        # Calculate daily usage
        from django.db.models import Count, F
        daily_usage_qs = (
            month_logs.values("timestamp__date")
            .annotate(
                requests=Count("id"),
                tokens=Sum(F("input_tokens") + F("output_tokens")),
                cost=Sum("estimated_cost"),
            )
            .order_by("timestamp__date")
        )
        daily_usage = [
            {
                "date": str(d["timestamp__date"]),
                "requests": d["requests"],
                "tokens": d["tokens"] or 0,
                "cost": round(float(d["cost"] or 0), 4),
            }
            for d in daily_usage_qs
        ]

        data = {
            "plan": PlanSerializer(plan).data if plan else None,
            "requests_used": requests_used,
            "monthly_requests_used": requests_used,
            "monthly_limit": monthly_limit,
            "remaining": remaining,
            "usage_percent": round(usage_percent, 2),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost": round(total_cost, 4),
            "budget_remaining": round(budget_remaining, 2),
            "projected_monthly_spend": round(projected_spend, 2),
            "budget_alert_threshold": float(org.budget_alert_threshold),
            "cache_hits": cache_hits,
            "cache_hit_rate": cache_hit_rate,
            "cache_savings": round(float(cache_savings), 4),
            "daily_usage": daily_usage,
        }
        response = Response(data)
        if usage_percent >= 80:
            response["X-Usage-Warning"] = "approaching_limit"
        return response


from rest_framework.renderers import BaseRenderer, JSONRenderer, BrowsableAPIRenderer


class PassthroughCSVRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if isinstance(data, (bytes, bytearray)):
            return data
        if isinstance(data, str):
            return data.encode(self.charset or "utf-8")
        return str(data).encode(self.charset or "utf-8")


class BillingUsageExportView(APIView):
    permission_classes = [IsAuthenticatedAndActive]
    renderer_classes = [PassthroughCSVRenderer, JSONRenderer, BrowsableAPIRenderer]

    def perform_content_negotiation(self, request, force=False):
        fmt = (request.query_params.get("format") or "csv").lower()
        if fmt == "json":
            return JSONRenderer(), "application/json"
        return PassthroughCSVRenderer(), "text/csv"

    def get(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        fmt = (request.query_params.get("format") or "csv").lower()
        logs = UsageLog.objects.filter(organization=org).order_by("-timestamp")
        if start_date:
            logs = logs.filter(timestamp__date__gte=start_date)
        if end_date:
            logs = logs.filter(timestamp__date__lte=end_date)
        if fmt == "json":
            serializer = UsageLogSerializer(logs, many=True)
            return Response(serializer.data, content_type="application/json")
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "endpoint", "model_used", "input_tokens", "output_tokens", "latency_ms", "estimated_cost", "cache_hit"])
        for log in logs:
            writer.writerow([
                log.timestamp.isoformat(), log.endpoint, log.model_used,
                log.input_tokens, log.output_tokens, log.latency_ms,
                log.estimated_cost, log.cache_hit,
            ])
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=usage_export.csv"
        return response


class APIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = APIKeySerializer
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    def get_queryset(self):
        org = get_request_org(self.request)
        return APIKey.objects.filter(organization=org) if org else APIKey.objects.none()

    def perform_create(self, serializer):
        org = get_request_org(self.request)
        api_key = serializer.save(organization=org)
        raw_key = getattr(api_key, "_raw_key", None)
        return api_key, raw_key

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        api_key, raw_key = self.perform_create(serializer)
        response_serializer = self.get_serializer(api_key)
        data = dict(response_serializer.data)
        if raw_key:
            data["full_key"] = raw_key
            data["raw_key"] = raw_key
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        api_key = self.get_object()
        new_key, raw_key = api_key.regenerate()
        serializer = self.get_serializer(new_key)
        data = dict(serializer.data)
        if raw_key:
            data["full_key"] = raw_key
            data["raw_key"] = raw_key
        return Response(data)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    def get_queryset(self):
        org = get_request_org(self.request)
        return Invoice.objects.filter(organization=org) if org else Invoice.objects.none()


class ModelConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ModelConfigSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return ModelConfig.objects.filter(organization=org) if org else ModelConfig.objects.none()
