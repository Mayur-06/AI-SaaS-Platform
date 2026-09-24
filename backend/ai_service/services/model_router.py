import time
import logging
import concurrent.futures
from typing import List, Optional, Dict, Any
from accounts.models import Organization
from billing.models import ModelConfig, RoutingRule

logger = logging.getLogger(__name__)

PLAN_PERMITTED_MODELS = {
    "free": ["gemini-2.5-flash"],
    "pro": ["gemini-2.5-flash", "gemini-2.5-pro"],
    "enterprise": ["gemini-2.5-flash", "gemini-2.5-pro"],
}


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, window_seconds: int = 60):
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

    def reset(self, model_key: Optional[str] = None):
        if model_key:
            self.failures.pop(model_key, None)
        else:
            self.failures.clear()

    def get_status(self, model_key: str) -> Dict[str, Any]:
        now = time.time()
        cutoff = now - self.window_seconds
        recent = [t for t in self.failures.get(model_key, []) if t > cutoff]
        is_open = len(recent) >= self.failure_threshold
        resets_in = 0
        if is_open and recent:
            oldest_relevant = min(recent[-self.failure_threshold:])
            resets_in = max(0, int((oldest_relevant + self.window_seconds) - now))
        return {
            "failure_count": len(recent),
            "threshold": self.failure_threshold,
            "is_open": is_open,
            "resets_in_seconds": resets_in,
        }

    def get_all_statuses(self) -> Dict[str, Dict[str, Any]]:
        statuses = {}
        for key in list(self.failures.keys()):
            statuses[key] = self.get_status(key)
        return statuses


# Process-wide shared circuit breaker to maintain failure states across router invocations
_shared_circuit_breaker = CircuitBreaker()


class ModelRouter:
    def __init__(
        self,
        organization: Optional[Organization] = None,
        circuit_breaker: Optional[CircuitBreaker] = None,
    ):
        self.organization = organization
        self.circuit_breaker = circuit_breaker or _shared_circuit_breaker
        self._provider_cache: Dict[str, Any] = {}

    @property
    def configs(self):
        return ModelConfig.objects.filter(is_active=True)

    def get_route(self) -> Dict[str, Any]:
        if not self.organization or not getattr(self.organization, "plan", None):
            primary = self.configs.filter(provider="gemini").first() or self.configs.first()
            gemini_fallback = (
                self.configs.filter(provider="gemini").exclude(id=getattr(primary, "id", None)).first()
                or self.configs.exclude(id=getattr(primary, "id", None)).first()
            )
            return {
                "primary": primary,
                "fallbacks": [gemini_fallback] if gemini_fallback else [],
                "timeout": 60,
            }
        try:
            rule = (
                RoutingRule.objects.select_related("primary_model")
                .prefetch_related("fallback_models")
                .filter(plan=self.organization.plan)
                .first()
            )
            if rule:
                return {
                    "primary": rule.primary_model,
                    "fallbacks": [fb for fb in rule.fallback_models.filter(is_active=True)],
                    "timeout": max(rule.timeout_seconds, 60),
                }
        except Exception as exc:
            logger.warning("Failed to fetch routing rule for org %s: %s", self.organization.id, exc)

        primary = self.configs.filter(provider="gemini").first() or self.configs.first()
        fallbacks = self.configs.filter(provider="gemini").exclude(id=getattr(primary, "id", None))[:2]
        return {"primary": primary, "fallbacks": list(fallbacks), "timeout": 60}

    def _get_provider_instance(self, model_config: ModelConfig):
        key = f"{model_config.provider}:{model_config.name}"
        if key in self._provider_cache:
            return self._provider_cache[key]
        from config import settings as django_settings
        import os

        gemini_key = getattr(django_settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            from pathlib import Path
            from dotenv import load_dotenv
            env_file = Path(__file__).resolve().parent.parent.parent / ".env"
            if env_file.exists():
                load_dotenv(dotenv_path=env_file)
                gemini_key = os.getenv("GEMINI_API_KEY")

        api_key_map = {
            "gemini": gemini_key,
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

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        target_model: Optional[str] = None,
        simulate_failure_models: Optional[List[str]] = None,
        simulate_timeout_models: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        route = self.get_route()
        primary = route.get("primary")
        fallbacks = route.get("fallbacks", [])
        base_timeout = route.get("timeout", 60)

        # Allow explicit target_model if requested and active
        original_primary = primary
        if target_model and target_model != "auto":
            override = ModelConfig.objects.filter(name=target_model, is_active=True).first()
            if override:
                primary = override

        # Build deduplicated candidate list of active models:
        # 1. Primary candidate (selected target_model or route primary)
        # 2. Original route primary (if different)
        # 3. Route fallbacks
        # 4. All active Gemini models as safety backups
        gemini_backups = list(ModelConfig.objects.filter(provider="gemini", is_active=True))
        pool = (
            ([primary] if primary and primary.is_active else [])
            + ([original_primary] if original_primary and original_primary.is_active else [])
            + [fb for fb in fallbacks if fb and fb.is_active]
            + [bm for bm in gemini_backups if bm and bm.is_active]
        )
        candidates = []
        seen_ids = set()
        for candidate in pool:
            if candidate and candidate.id not in seen_ids:
                seen_ids.add(candidate.id)
                candidates.append(candidate)

        if not candidates:
            raise RuntimeError("No active models configured or available for routing.")

        attempts = 0
        errors = []
        cascade_log = []

        for candidate in candidates:
            model_key = f"{candidate.provider}:{candidate.name}"

            # Dynamic timeout per model tier:
            # Pro reasoning models require at least 60s for large document synthesis.
            # Flash models require at least 45s.
            if "pro" in candidate.name.lower():
                cand_timeout = max(base_timeout, 60)
            else:
                cand_timeout = max(base_timeout, 45)

            # Check circuit breaker
            if self.circuit_breaker.is_open(model_key):
                cb_status = self.circuit_breaker.get_status(model_key)
                err_msg = f"Circuit breaker open for {model_key} ({cb_status['failure_count']} recent failures). Skipped."
                logger.info(err_msg)
                errors.append(err_msg)
                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "circuit_breaker_open",
                    "error": err_msg,
                })
                continue

            attempts += 1
            start = time.time()

            # Handle simulated failure hook
            if simulate_failure_models and (
                candidate.name in simulate_failure_models or model_key in simulate_failure_models
            ):
                self.circuit_breaker.record_failure(model_key)
                err_msg = f"{model_key}: Simulated upstream failure"
                errors.append(err_msg)
                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "failed",
                    "error": err_msg,
                    "latency_ms": 10,
                })
                continue

            # Handle simulated timeout hook
            if simulate_timeout_models and (
                candidate.name in simulate_timeout_models or model_key in simulate_timeout_models
            ):
                self.circuit_breaker.record_failure(model_key)
                err_msg = f"{model_key}: Timed out after {cand_timeout}s (simulated)"
                errors.append(err_msg)
                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "timeout",
                    "error": err_msg,
                    "latency_ms": cand_timeout * 1000,
                })
                continue

            try:
                provider = self._get_provider_instance(candidate)

                # Timeout enforcement using ThreadPoolExecutor
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                try:
                    future = executor.submit(
                        provider.generate,
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        temperature=temperature,
                    )
                    answer = future.result(timeout=cand_timeout)
                finally:
                    executor.shutdown(wait=False, cancel_futures=True)

                latency_ms = int((time.time() - start) * 1000)
                self.circuit_breaker.reset(model_key)

                # Accurate token estimation (~1.33 tokens per word for English text)
                raw_input_words = len(system_prompt.split()) + len(user_prompt.split())
                input_tokens = int(raw_input_words * 1.33) if raw_input_words > 0 else 0

                raw_output_words = len(answer.split())
                output_tokens = int(raw_output_words * 1.33) if raw_output_words > 0 else 0

                # Pricing calculated per 10,000 tokens (10k tokens = 10 * rate_per_1k)
                input_cost_per_10k = float(candidate.input_cost_per_1k) * 10
                output_cost_per_10k = float(candidate.output_cost_per_1k) * 10
                input_cost = (input_tokens / 10000.0) * input_cost_per_10k
                output_cost = (output_tokens / 10000.0) * output_cost_per_10k
                estimated_cost = round(input_cost + output_cost, 6)

                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "success",
                    "latency_ms": latency_ms,
                })

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
                    "cascade_log": cascade_log,
                }
            except concurrent.futures.TimeoutError:
                latency_ms = int((time.time() - start) * 1000)
                err_msg = f"{model_key}: Timed out after {cand_timeout}s"
                logger.warning("Model %s timed out after %ds (attempt %d)", model_key, cand_timeout, attempts)
                self.circuit_breaker.record_failure(model_key)
                errors.append(err_msg)
                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "timeout",
                    "error": err_msg,
                    "latency_ms": latency_ms,
                })
                continue
            except Exception as exc:
                latency_ms = int((time.time() - start) * 1000)
                err_msg = f"{model_key}: {exc}"
                logger.warning("Model %s failed (attempt %d): %s", model_key, attempts, exc)
                self.circuit_breaker.record_failure(model_key)
                errors.append(err_msg)
                cascade_log.append({
                    "model": candidate.name,
                    "provider": candidate.provider,
                    "status": "failed",
                    "error": err_msg,
                    "latency_ms": latency_ms,
                })
                continue

        raise RuntimeError(f"All models failed in fallback cascade. Errors: {errors}")
