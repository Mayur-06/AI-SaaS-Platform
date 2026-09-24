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
    CanQueryRAG, CanReadDocuments, CanWriteDocuments,
)

logger = logging.getLogger(__name__)

# Embedding cost rate calculated per 10,000 tokens ($0.0002 per 10k tokens = $0.02 / 1M tokens)
EMBEDDING_COST_PER_10K_TOKENS = 0.0002


def get_request_org(request):
    org = getattr(request, "organization", None)
    if org and getattr(org, "is_active", True):
        return org
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        target_org_id = request.headers.get("X-Organization-Id") or request.query_params.get("organization_id")
        if target_org_id:
            from accounts.models import Organization
            target_org = Organization.objects.filter(id=target_org_id, is_active=True).first()
            if target_org:
                return target_org
        membership = user.memberships.filter(is_active=True, organization__is_active=True).select_related("organization").first()
        if membership:
            return membership.organization
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            from accounts.models import Organization
            return Organization.objects.filter(is_active=True).first()
    return None


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticatedAndActive]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndActive(), CanReadDocuments()]
        return [IsAuthenticatedAndActive(), CanWriteDocuments()]

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
        title = serializer.validated_data.get("title") or self.request.data.get("title") or ""
        if file_obj:
            from django.core.files.storage import default_storage
            filename = file_obj.name
            saved_path = default_storage.save(f"documents/{org.id}/{filename}", file_obj)
            instance = serializer.save(organization=org, uploaded_by=self.request.user, filename=saved_path, title=title or filename)
        elif raw_content:
            from django.core.files.base import ContentFile
            from django.core.files.storage import default_storage
            filename = serializer.validated_data.get("filename", "document.txt")
            saved_path = default_storage.save(f"documents/{org.id}/{filename}", ContentFile(raw_content.encode("utf-8")))
            instance = serializer.save(organization=org, uploaded_by=self.request.user, filename=saved_path, title=title or filename)
        else:
            instance = serializer.save(organization=org, uploaded_by=self.request.user, title=title)

        # Auto-process into vector store immediately upon upload
        try:
            from ai_service.services.document_store import DjangoDocumentStore
            from ai_service.services.chunking import extract_and_chunk
            from django.core.files.storage import default_storage
            file_bytes = None
            if hasattr(instance, "filename") and instance.filename:
                try:
                    f = default_storage.open(instance.filename)
                    file_bytes = f.read()
                    f.close()
                except Exception:
                    pass
            if not file_bytes and raw_content:
                file_bytes = raw_content.encode("utf-8")
            if file_bytes:
                chunks = extract_and_chunk(file_bytes, instance.filename)
                if chunks:
                    store = DjangoDocumentStore(org)
                    store.add_document(str(instance.id), chunks)
                    approx_tokens = int(sum(len(c.split()) for c in chunks) * 1.33)
                    log_usage(
                        organization=org,
                        endpoint="/api/ai/documents/upload/",
                        model_used="embedding:all-MiniLM-L6-v2",
                        input_tokens=approx_tokens,
                        output_tokens=0,
                        latency_ms=0,
                        estimated_cost=round((approx_tokens / 10000.0) * EMBEDDING_COST_PER_10K_TOKENS, 6),
                        cache_hit=False,
                        request_id=getattr(self.request, "request_id", None),
                        user=self.request.user if getattr(self.request, "user", None) and self.request.user.is_authenticated else None,
                        api_key=getattr(self.request, "api_key", None),
                    )
        except Exception as exc:
            logger.warning("Auto-processing document %s failed: %s", instance.id, exc)

    def perform_destroy(self, instance):
        org = instance.organization
        if instance.filename:
            try:
                from django.core.files.storage import default_storage
                if default_storage.exists(instance.filename):
                    default_storage.delete(instance.filename)
            except Exception as exc:
                logger.warning("Failed to delete document file %s: %s", instance.filename, exc)
        instance.delete()
        if org:
            try:
                from ai_service.services.semantic_cache import SemanticCache
                SemanticCache(org).clear()
            except Exception as exc:
                logger.warning("Failed to clear semantic cache on document destruction: %s", exc)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        document = self.get_object()
        if document.status == Document.STATUS_READY:
            count = document.chunks.count()
            return Response({"detail": f"Document already processed.", "chunks_count": count, "chunk_count": count})
        if document.status != Document.STATUS_PENDING:
            return Response({"detail": "Document already processed or currently processing."}, status=status.HTTP_400_BAD_REQUEST)
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
        approx_tokens = int(sum(len(c.split()) for c in chunks) * 1.33)
        log_usage(
            organization=document.organization,
            endpoint="/api/ai/documents/process/",
            model_used="embedding:all-MiniLM-L6-v2",
            input_tokens=approx_tokens,
            output_tokens=0,
            latency_ms=0,
            estimated_cost=round((approx_tokens / 10000.0) * EMBEDDING_COST_PER_10K_TOKENS, 6),
            cache_hit=False,
            request_id=getattr(request, "request_id", None),
            user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            api_key=getattr(request, "api_key", None),
        )
        return Response({"detail": f"Processed {count} chunks.", "chunks_count": count})

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = self.get_object()
        DocumentChunk.objects.filter(document=document).delete()
        document.status = Document.STATUS_PENDING
        document.save(update_fields=["status"])
        return self.process(request, pk=pk)


class AIQueryView(APIView):
    permission_classes = [IsAuthenticatedAndActive, CanQueryRAG]

    @extend_schema(request=AIQueryRequestSerializer, responses=AIQueryResponseSerializer)
    def post(self, request):
        org = get_request_org(request)
        if not org:
            return Response({"detail": "No active organization."}, status=status.HTTP_403_FORBIDDEN)
        serializer = AIQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        requested_model = serializer.validated_data.get("model")

        # Validate requested model against organization's plan tier
        plan_name = (org.plan.name if org.plan and org.plan.name else "free").lower().strip()
        from ai_service.services.model_router import PLAN_PERMITTED_MODELS
        permitted = PLAN_PERMITTED_MODELS.get(plan_name, ["gemini-2.5-flash"])

        if requested_model and requested_model != "auto":
            if requested_model not in permitted:
                required_tier = "Enterprise" if requested_model == "gpt-4" else "Pro"
                return Response(
                    {
                        "error": {
                            "code": "MODEL_NOT_PERMITTED",
                            "message": f"Model '{requested_model}' is not available on the {plan_name.capitalize()} tier. Please upgrade to {required_tier} to use this model.",
                            "plan": plan_name,
                            "required_plan": required_tier.lower(),
                            "permitted_models": permitted,
                            "request_id": getattr(request, "request_id", str(__import__("uuid").uuid4())),
                        }
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            top_k = serializer.validated_data.get("top_k") or 8
            target_doc_id = serializer.validated_data.get("document_id")
            conversation_history = serializer.validated_data.get("conversation_history")
            orchestrator = RAGOrchestrator(
                organization=org,
                user=request.user,
                api_key=getattr(request, "api_key", None),
            )
            result = orchestrator.query(
                question,
                model=requested_model,
                top_k=top_k,
                target_doc_id=target_doc_id,
                conversation_history=conversation_history,
            )
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
            "cache_entries_count": stats["valid_entries"],
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
        return Response(
            {
                "status": "success",
                "message": "Semantic cache purged successfully.",
                "detail": "Cache cleared.",
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        return self.delete(request)


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
