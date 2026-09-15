from django.contrib import admin
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "filename", "status", "uploaded_by", "created_at"]
    search_fields = ["filename", "organization__name"]
    list_filter = ["status"]


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ["id", "document", "organization", "chunk_index", "created_at"]
    search_fields = ["document__filename"]
    list_filter = ["organization"]


@admin.register(AIQuery)
class AIQueryAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "query_text_short", "model_used", "cache_hit", "created_at"]
    search_fields = ["query_text", "response_text", "model_used"]
    list_filter = ["cache_hit"]

    def query_text_short(self, obj):
        return obj.query_text[:80]


@admin.register(CacheEntry)
class CacheEntryAdmin(admin.ModelAdmin):
    list_display = ["id", "organization", "model", "cache_key", "expires_at", "created_at"]
    search_fields = ["query_text", "model"]
    list_filter = ["organization"]
