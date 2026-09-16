import time
import logging
import secrets
import hashlib
from typing import List, Optional, Dict, Any
from django.db.models import F
from accounts.models import Organization
from billing.models import ModelConfig, RoutingRule

logger = logging.getLogger(__name__)


class CircuitBreaker:
    def __init__(self, failure_threshold=3, window_seconds=60):
        self.failure_threshold = failure_threshold
        self.window_seconds = window_seconds
        self.failures: Dict[str, List[float]] = {}

    def record_failure(self, model_key: str):
        now = time.time()
        if model_key not in self.failures:
            self.failures[model_key] = []
        self.failures[model_key].append(now)
        cutoff = now - self.window_seconds
        self.failures[model_key] = [t for t in self.failures[model_key] if t > cutoff]

    def is_open(self, model_key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        recent = [t for t in self.failures.get(model_key, []) if t > cutoff]
        self.failures[model_key] = recent
        return len(recent) >= self.failure_threshold

    def reset(self, model_key: str):
        self.failures.pop(model_key, None)


class ModelRouter:
    def __init__(self, organization: Optional[Organization] = None):
        self.organization = organization
        self.configs = ModelConfig.objects.filter(is_active=True)
        self.circuit_breaker = CircuitBreaker()
        self._provider_cache: Dict[str, Any] = {}

    def get_route(self) -> Dict[str, Any]:
        if not self.organization:
            return {
                "primary": self.configs.filter(provider="gemini").first(),
                "fallbacks": self.configs.filter(provider="openai").first(),
            }
        try:
            rule = RoutingRule.objects.select_related("primary_model").prefetch_related("fallback_models").get(
                plan=self.organization.plan
            )
            return {
                "primary": rule.primary_model,
                "fallbacks": list(rule.fallback_models.all()),
                "timeout": rule.timeout_seconds,
            }
        except RoutingRule.DoesNotExist:
            primary = self.configs.filter(provider="gemini").first()
            fallbacks = self.configs.filter(provider="openai")[:1]
            return {"primary": primary, "fallbacks": list(fallbacks), "timeout": 10}

    def _get_provider_instance(self, model_config: ModelConfig):
        key = f"{model_config.provider}:{model_config.name}"
        if key in self._provider_cache:
            return self._provider_cache[key]
        from config import settings as django_settings
        import os
        api_key_map = {
            "gemini": getattr(django_settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY"),
            "openai": getattr(django_settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY"),
            "anthropic": getattr(django_settings, "ANTHROPIC_API_KEY", None) or os.getenv("ANTHROPIC_API_KEY"),
            "groq": getattr(django_settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY"),
        }
        api_key = api_key_map.get(model_config.provider)
        if not api_key:
            raise ValueError(f"No API key configured for provider: {model_config.provider}")
        if model_config.provider == "gemini":
            from rag.providers.gemini import Gemini
            provider = Gemini(model_config.name, api_key=api_key)
        elif model_config.provider == "openai":
            from rag.providers.openai import OpenAIProvider
            provider = OpenAIProvider(api_key=api_key, model_name=model_config.name)
        elif model_config.provider == "anthropic":
            from rag.providers.claude import ClaudeProvider
            provider = ClaudeProvider(api_key=api_key, model_name=model_config.name)
        elif model_config.provider == "groq":
            from rag.providers.groq import GroqProvider
            provider = GroqProvider(api_key=api_key, model_name=model_config.name)
        else:
            raise ValueError(f"Unsupported provider: {model_config.provider}")
        self._provider_cache[key] = provider
        return provider

    def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        route = self.get_route()
        primary = route["primary"]
        fallbacks = route["fallbacks"]
        timeout = route.get("timeout", 10)
        candidates = [primary] + fallbacks if primary else list(fallbacks)
        attempts = 0
        errors = []
        import httpx
        for candidate in candidates:
            if candidate is None:
                continue
            model_key = f"{candidate.provider}:{candidate.name}"
            if self.circuit_breaker.is_open(model_key):
                logger.info("Circuit breaker open for %s, skipping", model_key)
                errors.append(f"Circuit breaker open for {model_key}")
                continue
            try:
                attempts += 1
                start = time.time()
                provider = self._get_provider_instance(candidate)
                answer = provider.generate(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                )
                latency_ms = int((time.time() - start) * 1000)
                self.circuit_breaker.reset(model_key)
                input_tokens = len(system_prompt.split()) + len(user_prompt.split())
                output_tokens = len(answer.split())
                input_cost = (input_tokens / 1000) * float(candidate.input_cost_per_1k)
                output_cost = (output_tokens / 1000) * float(candidate.output_cost_per_1k)
                return {
                    "answer": answer,
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "latency_ms": latency_ms,
                    "estimated_cost": input_cost + output_cost,
                    "attempts": attempts,
                    "errors": errors,
                }
            except Exception as exc:
                logger.warning("Model %s failed (attempt %d): %s", model_key, attempts, exc)
                self.circuit_breaker.record_failure(model_key)
                errors.append(f"{model_key}: {exc}")
                continue
        raise RuntimeError(f"All models failed. Errors: {errors}")
