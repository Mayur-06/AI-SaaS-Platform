import logging
import time
from django.utils import timezone
from rest_framework import status, viewsets, mixins, exceptions
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
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


def get_request_org(request):
    org = getattr(request, "organization", None)
    if org and getattr(org, "is_active", True):
        return org
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        membership = user.memberships.filter(is_active=True, organization__is_active=True).select_related("organization").first()
        if membership:
            return membership.organization
    return None


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndActive(), CanViewAI()]
        return [IsAuthenticatedAndActive(), CanUseAI()]

    def _get_org(self):
        return get_request_org(self.request)

    def get_queryset(self):
        org = self._get_org()
        return Document.objects.filter(organization=org) if org else Document.objects.none()

    def perform_create(self, serializer):
        org = self._get_org()
        if not org:
            raise exceptions.ValidationError("No active organization.")
        raw_content = serializer.validated_data.pop("content", None) or self.request.data.get("content")
        file_obj = serializer.validated_data.pop("file", None) or self.request.FILES.get("file")
        if file_obj:
            from django.core.files.storage import default_storage
            filename = file_obj.name
            saved_path = default_storage.save(f"documents/{org.id}/{filename}", file_obj)
            serializer.save(organization=org, uploaded_by=self.request.user, filename=saved_path)
        elif raw_content:
            from django.core.files.base import ContentFile
            from django.core.files.storage import default_storage
            filename = serializer.validated_data.get("filename", "document.txt")
            saved_path = default_storage.save(f"documents/{org.id}/{filename}", ContentFile(raw_content.encode("utf-8")))
            serializer.save(organization=org, uploaded_by=self.request.user, filename=saved_path)
        else:
            serializer.save(organization=org, uploaded_by=self.request.user)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        document = self.get_object()
        if document.status != Document.STATUS_PENDING:
            return Response({"detail": "Document already processed."}, status=status.HTTP_400_BAD_REQUEST)
        from ai_service.services.document_store import DjangoDocumentStore
        from ai_service.services.chunking import extract_and_chunk
        from django.core.files.storage import default_storage
        file_bytes = None
        try:
            file_obj = default_storage.open(document.filename)
            file_bytes = file_obj.read()
            file_obj.close()
        except Exception:
            raw_content = request.data.get("content")
            if raw_content:
                file_bytes = raw_content.encode("utf-8")
            else:
                return Response({"detail": f"File read failed: could not open '{document.filename}'"}, status=status.HTTP_400_BAD_REQUEST)
        chunks = extract_and_chunk(file_bytes, document.filename)
        store = DjangoDocumentStore(document.organization)
        count = store.add_document(str(document.id), chunks)
        return Response({"detail": f"Processed {count} chunks.", "chunks_count": count})

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = self.get_object()
        DocumentChunk.objects.filter(document=document).delete()
        document.status = Document.STATUS_PENDING
        document.save(update_fields=["status"])
        return self.process(request, pk=pk)


class AIQueryView(APIView):
    permission_classes = [IsAuthenticatedAndActive, CanUseAI]

    @extend_schema(request=AIQueryRequestSerializer, responses=AIQueryResponseSerializer)
    def post(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        serializer = AIQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        try:
            orchestrator = RAGOrchestrator(organization=org, user=request.user, api_key=getattr(request, "api_key", None))
            start = time.time()
            result = orchestrator.query(question)
            result["response"] = result.get("answer")
            result["model_used"] = result.get("model")
            result["tokens"] = {
                "prompt_tokens": result.get("input_tokens", 0),
                "completion_tokens": result.get("output_tokens", 0),
                "total_tokens": result.get("input_tokens", 0) + result.get("output_tokens", 0),
            }
            response_serializer = AIQueryResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except (RuntimeError, OSError) as exc:
            logger.warning("AI query service unavailable or resource constrained: %s", exc)
            return Response(
                {"error": {"code": "SERVICE_UNAVAILABLE", "message": str(exc), "request_id": getattr(request, "request_id", str(__import__("uuid").uuid4()))}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            logger.exception("AI query failed: %s", exc)
            return Response(
                {"error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc), "request_id": getattr(request, "request_id", str(__import__("uuid").uuid4()))}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AIHistoryView(APIView):
    permission_classes = [IsAuthenticatedAndActive, CanViewAI]

    def get(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
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
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        from ai_service.services.semantic_cache import get_cache_ttl, SemanticCache
        cache = SemanticCache(org)
        stats = cache.get_stats()
        data = {
            "total_entries": stats["total_entries"],
            "valid_entries": stats["valid_entries"],
            "threshold": cache.threshold,
            "ttl_seconds": get_cache_ttl(org),
        }
        return Response(data)


class CacheClearView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    def delete(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        cache = SemanticCache(org)
        cache.clear()
        return Response({"detail": "Cache cleared."}, status=status.HTTP_204_NO_CONTENT)


class CacheThresholdView(APIView):
    permission_classes = [IsAuthenticatedAndActive, IsAdminOrOwner]

    def get(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        cache = SemanticCache(org)
        return Response({"threshold": cache.threshold})

    @extend_schema(request=CacheThresholdSerializer, responses=CacheThresholdSerializer)
    def patch(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CacheThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org.cache_threshold = serializer.validated_data["threshold"]
        org.save(update_fields=["cache_threshold"])
        return Response({"threshold": org.cache_threshold})
