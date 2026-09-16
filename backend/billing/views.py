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


class BillingPlanView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PlanSerializer(org.plan)
        return Response(serializer.data)

    @extend_schema(request={"type": "object", "properties": {"plan": {"type": "string"}}, "required": ["plan"]}, responses=PlanSerializer)
    def post(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        new_plan_name = request.data.get("plan")
        if not new_plan_name:
            return Response({"detail": "plan is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_plan = Plan.objects.get(name=new_plan_name)
        except Plan.DoesNotExist:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)
        org.plan = new_plan
        org.save(update_fields=["plan"])
        return Response(PlanSerializer(org.plan).data)


class BillingUpgradeView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    @transaction.atomic
    @extend_schema(request={"type": "object", "properties": {"plan": {"type": "string"}}, "required": ["plan"]}, responses=PlanSerializer)
    def post(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        new_plan_name = request.data.get("plan")
        if not new_plan_name:
            return Response({"detail": "plan is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            new_plan = Plan.objects.get(name=new_plan_name)
        except Plan.DoesNotExist:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)
        org.plan = new_plan
        org.save(update_fields=["plan"])
        return Response(PlanSerializer(new_plan).data)


class BillingUsageView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = getattr(request, "organization", None)
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
        budget_remaining = float(org.monthly_budget) - float(total_cost)
        projected_spend = float(total_cost) * (30 / max(1, (now - month_start).days + 1)) * 30

        data = {
            "plan": PlanSerializer(plan).data if plan else None,
            "requests_used": requests_used,
            "monthly_limit": monthly_limit,
            "remaining": remaining,
            "usage_percent": round(usage_percent, 2),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost": round(total_cost, 4),
            "budget_remaining": round(budget_remaining, 2),
            "projected_monthly_spend": round(projected_spend, 2),
            "budget_alert_threshold": float(org.budget_alert_threshold),
        }
        response = Response(data)
        if usage_percent >= 80:
            response["X-Usage-Warning"] = "approaching_limit"
        return response


class BillingUsageExportView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        fmt = request.query_params.get("format", "csv")
        logs = UsageLog.objects.filter(organization=org)
        if start_date:
            logs = logs.filter(timestamp__date__gte=start_date)
        if end_date:
            logs = logs.filter(timestamp__date__lte=end_date)
        if fmt == "json":
            serializer = UsageLogSerializer(logs, many=True)
            return Response(serializer.data)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "endpoint", "model_used", "input_tokens", "output_tokens", "latency_ms", "estimated_cost", "cache_hit"])
        for log in logs:
            writer.writerow([
                log.timestamp.isoformat(), log.endpoint, log.model_used,
                log.input_tokens, log.output_tokens, log.latency_ms,
                log.estimated_cost, log.cache_hit,
            ])
        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=usage_export.csv"
        return response


class APIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = APIKeySerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return APIKey.objects.filter(organization=org) if org else APIKey.objects.none()

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        api_key = serializer.save(organization=org)
        raw_key = getattr(api_key, "_raw_key", None)
        return api_key, raw_key

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        api_key, raw_key = self.perform_create(serializer)
        response_serializer = self.get_serializer(api_key)
        data = response_serializer.data
        if raw_key:
            data["full_key"] = raw_key
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        api_key = self.get_object()
        new_key, raw_key = api_key.regenerate()
        serializer = self.get_serializer(new_key)
        return Response({
            **serializer.data,
            "full_key": raw_key,
            "raw_key": raw_key,
        })


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return Invoice.objects.filter(organization=org) if org else Invoice.objects.none()


class ModelConfigViewSet(viewsets.ModelViewSet):
    serializer_class = ModelConfigSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return ModelConfig.objects.filter(organization=org) if org else ModelConfig.objects.none()
