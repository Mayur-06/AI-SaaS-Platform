import os
import re
import time
import logging
import google.generativeai as genai
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Maximum number of retries on rate limit errors before giving up
_MAX_RATE_LIMIT_RETRIES = 5


class Gemini:
    """
    Wrapper around Gemini for text generation.
    Includes automatic exponential-backoff retry for RATE_LIMIT_EXCEEDED (429) errors.
    """

    MODEL_ALIASES = {
        "gemini-2.0-flash": "gemini-2.5-flash",
        "gemini-1.5-flash": "gemini-2.5-flash",
        "gemini-1.5-pro": "gemini-2.5-pro",
        "gpt-4": "gemini-2.5-pro",
        "gpt-4o-mini": "gemini-2.5-flash",
        "gpt-3.5-turbo": "gemini-2.5-flash",
    }

    def __init__(self, model_name="gemini-2.5-flash", api_key=None):
        load_dotenv()

        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            try:
                from django.conf import settings
                api_key = getattr(settings, "GEMINI_API_KEY", None)
            except Exception:
                pass

        if not api_key:
            from pathlib import Path
            env_file = Path(__file__).resolve().parent.parent.parent / ".env"
            if env_file.exists():
                load_dotenv(dotenv_path=env_file)
                api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY not found in .env or settings"
            )

        model_name = self.MODEL_ALIASES.get(model_name, model_name)

        genai.configure(api_key=api_key)
        self.model_name = model_name
        self.model = genai.GenerativeModel(model_name)

    @staticmethod
    def _is_rate_limit_error(exc: Exception) -> bool:
        """Return True if the exception is a Gemini rate-limit (429) error."""
        err_str = str(exc).upper()
        return "RATE_LIMIT_EXCEEDED" in err_str or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str

    @staticmethod
    def _parse_retry_after(exc: Exception) -> int:
        """
        Try to extract the suggested retry-after delay (in seconds) from the
        error message. Falls back to 0 if not found.
        """
        match = re.search(r"retry after (\d+)s", str(exc), re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 0

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:

        prompt = f"""
{system_prompt}

Context and Question:

{user_prompt}
"""

        last_exc: Exception | None = None

        for attempt in range(1, _MAX_RATE_LIMIT_RETRIES + 1):
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        temperature=temperature,
                    ),
                )
                text = response.text.strip()
                if isinstance(text, bytes):
                    text = text.decode("utf-8", errors="replace")
                return text

            except Exception as exc:
                if not self._is_rate_limit_error(exc):
                    # Non-rate-limit errors bubble up immediately
                    raise

                last_exc = exc

                # Honour the server's suggested wait time, or fall back to
                # exponential backoff: 2s → 4s → 8s → 16s → 32s
                retry_after = self._parse_retry_after(exc)
                wait = retry_after if retry_after > 0 else (2 ** attempt)

                logger.warning(
                    "Gemini rate limit hit on model %s (attempt %d/%d). "
                    "Retrying in %ds. Error: %s",
                    self.model_name, attempt, _MAX_RATE_LIMIT_RETRIES, wait, exc,
                )
                time.sleep(wait)

        # All retries exhausted — re-raise the last rate-limit exception so the
        # ModelRouter's circuit breaker can handle it correctly.
        raise last_exc