from django.contrib import admin
from billing.models import Plan, APIKey, Invoice, UsageLog, UsageAggregate, ModelConfig, RoutingRule


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "monthly_request_limit", "requests_per_minute", "price"]
    search_fields = ["name"]


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "name", "key_prefix", "permissions", "is_active", "last_used_at"]
    search_fields = ["name", "key_prefix", "organization__name"]
    list_filter = ["permissions", "is_active"]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "period_start", "period_end", "amount", "status"]
    search_fields = ["organization__name"]
    list_filter = ["status"]


@admin.register(UsageLog)
class UsageLogAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "endpoint", "model_used", "input_tokens", "output_tokens", "estimated_cost", "cache_hit", "timestamp"]
    search_fields = ["organization__name", "endpoint", "model_used"]
    list_filter = ["cache_hit"]
    readonly_fields = ["id", "timestamp"]


@admin.register(UsageAggregate)
class UsageAggregateAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "month", "total_requests", "total_cost"]
    search_fields = ["organization__name", "month"]


@admin.register(ModelConfig)
class ModelConfigAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "provider", "input_cost_per_1k", "output_cost_per_1k", "is_active"]
    search_fields = ["name", "provider"]


@admin.register(RoutingRule)
class RoutingRuleAdmin(admin.ModelAdmin):
    list_display = ["id", "plan", "primary_model", "timeout_seconds"]
    search_fields = ["plan__name", "primary_model__name"]
    filter_horizontal = ["fallback_models"]
