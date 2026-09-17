from rest_framework import serializers
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry
from ai_service.services.document_store import DjangoDocumentStore
from ai_service.services.chunking import extract_and_chunk
from accounts.models import Organization


class DocumentSerializer(serializers.ModelSerializer):
    filename = serializers.CharField(max_length=255, required=False)
    title = serializers.CharField(max_length=255, required=False, write_only=True)
    content = serializers.CharField(required=False, write_only=True)
    file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = Document
        fields = ["id", "filename", "title", "content", "file", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        if not attrs.get("filename") and attrs.get("title"):
            attrs["filename"] = attrs["title"]
        if not attrs.get("filename") and not attrs.get("file"):
            raise serializers.ValidationError("Either 'filename' (or 'title') or 'file' is required.")
        if not attrs.get("filename") and attrs.get("file"):
            attrs["filename"] = attrs["file"].name
        return attrs

    def create(self, validated_data):
        validated_data.pop("title", None)
        validated_data.pop("content", None)
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["title"] = instance.filename
        return data


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    filename = serializers.CharField(max_length=255)


class AIQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIQuery
        fields = ["id", "query_text", "response_text", "model_used", "input_tokens", "output_tokens", "latency_ms", "estimated_cost", "cache_hit", "created_at"]
        read_only_fields = ["id", "created_at"]


class AIQueryRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=10000, required=False)
    prompt = serializers.CharField(max_length=10000, required=False)
    model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    top_k = serializers.IntegerField(min_value=1, max_value=10, default=3)

    def validate(self, attrs):
        q = attrs.get("question") or attrs.get("prompt")
        if not q:
            raise serializers.ValidationError("Either 'question' or 'prompt' is required.")
        attrs["question"] = q
        return attrs


class AIQueryResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    response = serializers.CharField(required=False)
    model = serializers.CharField()
    model_used = serializers.CharField(required=False)
    provider = serializers.CharField()
    input_tokens = serializers.IntegerField()
    output_tokens = serializers.IntegerField()
    tokens = serializers.DictField(required=False)
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
