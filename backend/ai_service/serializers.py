from rest_framework import serializers
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry
from ai_service.services.document_store import DjangoDocumentStore
from ai_service.services.chunking import extract_and_chunk
from accounts.models import Organization


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["id", "filename", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    filename = serializers.CharField(max_length=255)


class AIQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIQuery
        fields = ["id", "query_text", "response_text", "model_used", "input_tokens", "output_tokens", "latency_ms", "estimated_cost", "cache_hit", "created_at"]
        read_only_fields = ["id", "created_at"]


class AIQueryRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=10000)
    top_k = serializers.IntegerField(min_value=1, max_value=10, default=3)


class AIQueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    model = serializers.CharField()
    provider = serializers.CharField()
    input_tokens = serializers.IntegerField()
    output_tokens = serializers.IntegerField()
    latency_ms = serializers.IntegerField()
    estimated_cost = serializers.FloatField()
    cache_hit = serializers.BooleanField()
    request_id = serializers.CharField()
    chunks_retrieved = serializers.IntegerField(required=False)


class CacheStatsSerializer(serializers.Serializer):
    total_entries = serializers.IntegerField()
    valid_entries = serializers.IntegerField()
    threshold = serializers.FloatField()
    ttl_seconds = serializers.IntegerField()


class CacheThresholdSerializer(serializers.Serializer):
    threshold = serializers.FloatField(min_value=0.0, max_value=1.0)
