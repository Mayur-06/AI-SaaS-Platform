from rest_framework import serializers
from billing.models import Plan, APIKey, Invoice, UsageLog, UsageAggregate, ModelConfig, RoutingRule


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ["id", "name", "monthly_request_limit", "requests_per_minute", "cache_ttl_seconds", "price"]
        read_only_fields = ["id"]


class APIKeySerializer(serializers.ModelSerializer):
    full_key = serializers.CharField(read_only=True, required=False)
    raw_key = serializers.CharField(read_only=True, required=False)

    class Meta:
        model = APIKey
        fields = ["id", "name", "key_prefix", "full_key", "raw_key", "permissions", "rate_limit_override", "last_used_at", "is_active", "created_at"]
        read_only_fields = ["id", "key_prefix", "full_key", "raw_key", "last_used_at", "created_at"]

    def create(self, validated_data):
        validated_data.pop("full_key", None)
        validated_data.pop("raw_key", None)
        if "organization" not in validated_data or validated_data["organization"] is None:
            request = self.context.get("request")
            org = getattr(request, "organization", None)
            if not org and request and getattr(request, "user", None) and request.user.is_authenticated:
                m = request.user.memberships.filter(is_active=True, organization__is_active=True).first()
                if m:
                    org = m.organization
            validated_data["organization"] = org
        return APIKey.objects.create(**validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ["id", "period_start", "period_end", "amount", "status", "created_at"]
        read_only_fields = ["id", "created_at"]


class UsageLogSerializer(serializers.ModelSerializer):
    api_key_name = serializers.CharField(source="api_key.name", read_only=True, default=None)
    api_key_prefix = serializers.CharField(source="api_key.key_prefix", read_only=True, default=None)

    class Meta:
        model = UsageLog
        fields = [
            "id", "endpoint", "model_used", "input_tokens", "output_tokens",
            "latency_ms", "estimated_cost", "cache_hit", "timestamp",
            "api_key_name", "api_key_prefix",
        ]
        read_only_fields = ["id", "timestamp"]


class UsageAggregateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsageAggregate
        fields = ["id", "date", "month", "total_requests", "input_tokens", "output_tokens", "total_cost", "cache_hits", "cache_savings"]
        read_only_fields = ["id"]


class ModelConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelConfig
        fields = ["id", "name", "provider", "input_cost_per_1k", "output_cost_per_1k", "is_active"]
        read_only_fields = ["id"]


class RoutingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutingRule
        fields = ["id", "plan", "primary_model", "fallback_models", "timeout_seconds"]
        read_only_fields = ["id"]


class UsageExportSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    format = serializers.ChoiceField(choices=["csv", "json"], default="csv")
