import uuid
import secrets
import string
import hashlib
from django.db import models, transaction
from django.db.models import Q, UniqueConstraint, Sum, Count
from django.utils import timezone
from datetime import timedelta
from accounts.models import Organization


def generate_api_key():
    return "sk_live_" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))


class Plan(models.Model):
    PLAN_FREE = "free"
    PLAN_PRO = "pro"
    PLAN_ENTERPRISE = "enterprise"
    PLAN_CHOICES = [
        (PLAN_FREE, "Free"),
        (PLAN_PRO, "Pro"),
        (PLAN_ENTERPRISE, "Enterprise"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, choices=PLAN_CHOICES, unique=True)
    monthly_request_limit = models.IntegerField(default=100)
    requests_per_minute = models.IntegerField(default=10)
    cache_ttl_seconds = models.IntegerField(default=3600)
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["price"]

    def __str__(self):
        return self.name


class APIKey(models.Model):
    PERMISSION_READ = "read"
    PERMISSION_WRITE = "write"
    PERMISSION_ADMIN = "admin"
    PERMISSION_CHOICES = [
        (PERMISSION_READ, "Read"),
        (PERMISSION_WRITE, "Write"),
        (PERMISSION_ADMIN, "Admin"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=255)
    key_prefix = models.CharField(max_length=16, editable=False)
    key_hash = models.CharField(max_length=255, editable=False)
    permissions = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default=PERMISSION_WRITE)
    rate_limit_override = models.IntegerField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.key_prefix and not self.key_hash:
            raw_key = generate_api_key()
            self.key_prefix = raw_key[:12]
            self.key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            self._raw_key = raw_key
        else:
            self._raw_key = None
        super().save(*args, **kwargs)

    @staticmethod
    def verify_key(raw_key, organization=None):
        prefix = raw_key[:12]
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        import hmac
        try:
            filters = {"key_prefix": prefix, "is_active": True}
            if organization is not None:
                filters["organization"] = organization
            api_key = APIKey.objects.select_related("organization", "organization__plan").get(**filters)
            if hmac.compare_digest(api_key.key_hash, key_hash):
                api_key.last_used_at = timezone.now()
                api_key.save(update_fields=["last_used_at"])
                return api_key
        except (APIKey.DoesNotExist, APIKey.MultipleObjectsReturned):
            pass
        try:
            filters = {"key_hash": key_hash, "is_active": True}
            if organization is not None:
                filters["organization"] = organization
            api_key = APIKey.objects.select_related("organization", "organization__plan").get(**filters)
            api_key.last_used_at = timezone.now()
            api_key.save(update_fields=["last_used_at"])
            return api_key
        except APIKey.DoesNotExist:
            return None

    def regenerate(self):
        self.is_active = False
        self.save(update_fields=["is_active"])
        new_key = APIKey.objects.create(
            organization=self.organization,
            name=f"{self.name} (regenerated)",
            permissions=self.permissions,
            rate_limit_override=self.rate_limit_override,
        )
        return new_key, getattr(new_key, "_raw_key", None)

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"


class ModelConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    provider = models.CharField(max_length=50)
    input_cost_per_1k = models.DecimalField(max_digits=10, decimal_places=6)
    output_cost_per_1k = models.DecimalField(max_digits=10, decimal_places=6)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.provider}/{self.name}"


class RoutingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="routing_rules")
    primary_model = models.ForeignKey(ModelConfig, on_delete=models.PROTECT, related_name="primary_rules")
    fallback_models = models.ManyToManyField(ModelConfig, related_name="fallback_rules", blank=True)
    timeout_seconds = models.IntegerField(default=60)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [("plan", "primary_model")]
        ordering = ["plan__name"]

    def __str__(self):
        return f"{self.plan.name} -> {self.primary_model.name}"


class UsageLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="usage_logs")
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="usage_logs")
    api_key = models.ForeignKey(APIKey, on_delete=models.SET_NULL, null=True, blank=True, related_name="usage_logs")
    endpoint = models.CharField(max_length=255)
    model_used = models.CharField(max_length=255)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    latency_ms = models.IntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    cache_hit = models.BooleanField(default=False)
    request_id = models.CharField(max_length=36, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    month = models.CharField(max_length=7, editable=False, default="")

    class Meta:
        indexes = [
            models.Index(fields=["organization", "timestamp"]),
            models.Index(fields=["organization", "month"]),
            models.Index(fields=["api_key_id"]),
        ]
        ordering = ["-timestamp"]

    def save(self, *args, **kwargs):
        if not self.month:
            self.month = self.timestamp.strftime("%Y-%m")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.organization} - {self.endpoint} - {self.timestamp}"


class UsageAggregate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="usage_aggregates")
    date = models.DateField()
    month = models.CharField(max_length=7)
    total_requests = models.IntegerField(default=0)
    input_tokens = models.BigIntegerField(default=0)
    output_tokens = models.BigIntegerField(default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    cache_hits = models.IntegerField(default=0)
    cache_savings = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    class Meta:
        unique_together = [("organization", "month")]
        ordering = ["-month"]
        indexes = [
            models.Index(fields=["organization", "month"]),
        ]

    def __str__(self):
        return f"{self.organization} - {self.month}"


class Invoice(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_PAID = "paid"
    STATUS_VOID = "void"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SENT, "Sent"),
        (STATUS_PAID, "Paid"),
        (STATUS_VOID, "Void"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invoices")
    period_start = models.DateField()
    period_end = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-period_end"]

    def __str__(self):
        return f"Invoice {self.id} for {self.organization.name}"
