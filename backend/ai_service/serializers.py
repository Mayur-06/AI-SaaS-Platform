from rest_framework import serializers
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry
from ai_service.services.document_store import DjangoDocumentStore
from ai_service.services.chunking import extract_and_chunk
from accounts.models import Organization


class DocumentSerializer(serializers.ModelSerializer):
    filename = serializers.CharField(max_length=255, required=False)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    content = serializers.CharField(required=False, write_only=True)
    file = serializers.FileField(write_only=True, required=False)
    chunk_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "filename", "title", "content", "file", "status", "chunk_count", "created_at"]
        read_only_fields = ["id", "status", "chunk_count", "created_at"]

    def get_chunk_count(self, obj):
        return obj.chunks.count()

    def validate(self, attrs):
        if not attrs.get("filename") and attrs.get("title"):
            attrs["filename"] = attrs["title"]
        if not attrs.get("filename") and not attrs.get("file"):
            raise serializers.ValidationError("Either 'filename' (or 'title') or 'file' is required.")
        if not attrs.get("filename") and attrs.get("file"):
            attrs["filename"] = attrs["file"].name
        if not attrs.get("title") and attrs.get("filename"):
            attrs["title"] = attrs["filename"]
        return attrs

    def create(self, validated_data):
        validated_data.pop("content", None)
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        filename = instance.filename or "Document"
        clean_name = filename.split("/")[-1] if "/" in filename else (filename.split("\\")[-1] if "\\" in filename else filename)
        data["title"] = instance.title if instance.title else clean_name
        data["chunk_count"] = instance.chunks.count()
        return data



class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    filename = serializers.CharField(max_length=255)


class AIQuerySerializer(serializers.ModelSerializer):
    total_tokens = serializers.SerializerMethodField()

    class Meta:
        model = AIQuery
        fields = ["id", "query_text", "response_text", "model_used", "input_tokens", "output_tokens", "total_tokens", "latency_ms", "estimated_cost", "cache_hit", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_total_tokens(self, obj):
        return (obj.input_tokens or 0) + (obj.output_tokens or 0)


class AIQueryRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=10000, required=False)
    prompt = serializers.CharField(max_length=10000, required=False)
    model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    top_k = serializers.IntegerField(min_value=1, max_value=20, default=8)
    document_id = serializers.UUIDField(required=False, allow_null=True)

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
    cited_chunks = serializers.ListField(child=serializers.DictField(), required=False)


class CacheStatsSerializer(serializers.Serializer):
    total_entries = serializers.IntegerField()
    valid_entries = serializers.IntegerField()
    threshold = serializers.FloatField()
    ttl_seconds = serializers.IntegerField()


class CacheThresholdSerializer(serializers.Serializer):
    threshold = serializers.FloatField(
        min_value=0.80,
        max_value=0.99,
        error_messages={
            "min_value": "Match threshold must be between 0.80 and 0.99.",
            "max_value": "Match threshold must be between 0.80 and 0.99.",
        },
    )

