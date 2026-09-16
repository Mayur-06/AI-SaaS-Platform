import uuid
from django.db import models
from django.db.models import UniqueConstraint
from django.utils import timezone
from accounts.models import Organization


class Document(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="documents")
    filename = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    uploaded_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents_uploaded")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.organization.name})"


class DocumentChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="document_chunks")
    chunk_text = models.TextField()
    embedding_vector = models.JSONField(null=True, blank=True)
    chunk_index = models.IntegerField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "document"]),
        ]
        ordering = ["document", "chunk_index"]

    def __str__(self):
        return f"Chunk {self.chunk_index} of {self.document.filename}"


class AIQuery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="queries")
    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="queries")
    api_key = models.ForeignKey("billing.APIKey", on_delete=models.SET_NULL, null=True, blank=True, related_name="queries")
    query_text = models.TextField()
    response_text = models.TextField()
    model_used = models.CharField(max_length=255)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    latency_ms = models.IntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    cache_hit = models.BooleanField(default=False)
    request_id = models.CharField(max_length=36, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=["organization", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization} - {self.query_text[:50]}"


class CacheEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="cache_entries")
    cache_key = models.CharField(max_length=255, db_index=True)
    query_text = models.TextField()
    model = models.CharField(max_length=255)
    response_text = models.TextField()
    token_metadata = models.JSONField(null=True, blank=True)
    embedding_vector = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["organization", "cache_key"]),
            models.Index(fields=["organization", "expires_at"]),
        ]
        ordering = ["-created_at"]

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"CacheEntry {self.cache_key[:32]}..."
