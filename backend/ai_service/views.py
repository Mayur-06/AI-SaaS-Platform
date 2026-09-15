import logging
import time
from django.utils import timezone
from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum
from ai_service.models import Document, DocumentChunk, AIQuery, CacheEntry
from ai_service.serializers import (
    DocumentSerializer, DocumentUploadSerializer, AIQuerySerializer,
    AIQueryRequestSerializer, AIQueryResponseSerializer, CacheStatsSerializer, CacheThresholdSerializer,
)
from ai_service.services.rag_orchestrator import RAGOrchestrator
from ai_service.services.semantic_cache import SemanticCache
from ai_service.services.document_store import DjangoDocumentStore
from ai_service.services.usage_tracker import log_usage
from common.core.permissions import (
    IsAuthenticatedAndActive, IsAdminOrOwner, CanUseAI, CanViewAI, IsSuperAdmin,
)

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        return Document.objects.filter(organization=org) if org else Document.objects.none()

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        serializer.save(organization=org, uploaded_by=self.request.user)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        document = self.get_object()
        if document.status != Document.STATUS_PENDING:
            return Response({"detail": "Document already processed."}, status=status.HTTP_400_BAD_REQUEST)
        from ai_service.services.document_store import DjangoDocumentStore
        from ai_service.services.chunking import extract_and_chunk
        from django.core.files.storage import default_storage
        try:
            file_obj = default_storage.open(document.filename)
            file_bytes = file_obj.read()
            file_obj.close()
        except Exception as exc:
            return Response({"detail": f"File read failed: {exc}"}, status=status.HTTP_400_BAD_REQUEST)
        chunks = extract_and_chunk(file_bytes, document.filename)
        store = DjangoDocumentStore(document.organization)
        count = store.add_document(str(document.id), chunks)
        return Response({"detail": f"Processed {count} chunks."})

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = self.get_object()
        DocumentChunk.objects.filter(document=document).delete()
        document.status = Document.STATUS_PENDING
        document.save(update_fields=["status"])
        return self.process(request, pk=pk)


class AIQueryView(APIView):
    permission_classes = [IsAuthenticatedAndActive, CanUseAI]

    def post(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AIQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        try:
            orchestrator = RAGOrchestrator(organization=org, user=request.user, api_key=getattr(request, "api_key", None))
            start = time.time()
            result = orchestrator.query(question)
            response_serializer = AIQueryResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except RuntimeError as exc:
            return Response(
                {"error": {"code": "MODEL_UNAVAILABLE", "message": str(exc), "request_id": str(__import__("uuid").uuid4())}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            logger.exception("AI query failed: %s", exc)
            return Response(
                {"error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc), "request_id": str(__import__("uuid").uuid4())}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIHistoryView(APIView):
    permission_classes = [IsAuthenticatedAndActive, CanViewAI]

    def get(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        limit = int(request.query_params.get("limit", 10))
        sort = request.query_params.get("sort", "date")
        qs = AIQuery.objects.filter(organization=org)
        if sort == "cost":
            qs = qs.order_by("-estimated_cost")
        elif sort == "model":
            qs = qs.order_by("-model_used")
        else:
            qs = qs.order_by("-created_at")
        queries = qs[:limit]
        serializer = AIQuerySerializer(queries, many=True)
        return Response({"results": serializer.data, "count": len(serializer.data)})


class CacheStatsView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def get(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        is_super = request.user.is_staff
        if not is_super:
            from ai_service.services.semantic_cache import get_cache_ttl
            cache = SemanticCache(org)
        else:
            from ai_service.services.semantic_cache import SemanticCache
            cache = SemanticCache(org)
        stats = cache.get_stats()
        from ai_service.services.semantic_cache import get_cache_ttl
        data = {
            "total_entries": stats["total_entries"],
            "valid_entries": stats["valid_entries"],
            "threshold": cache.threshold,
            "ttl_seconds": get_cache_ttl(org),
        }
        return Response(data)


class CacheClearView(APIView):
    permission_classes = [IsAuthenticatedAndActive]

    def delete(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        cache = SemanticCache(org)
        cache.clear()
        return Response({"detail": "Cache cleared."}, status=status.HTTP_204_NO_CONTENT)


class CacheThresholdView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    def get(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        cache = SemanticCache(org)
        return Response({"threshold": cache.threshold})

    def patch(self, request):
        org = getattr(request, "organization", None)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CacheThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from ai_service.models import CacheEntry
        from django.db.models import F
        CacheEntry.objects.filter(organization=org).update(threshold=serializer.validated_data["threshold"])
        return Response({"threshold": serializer.validated_data["threshold"]})
