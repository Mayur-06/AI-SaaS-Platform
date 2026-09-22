import os
import google.generativeai as genai
from dotenv import load_dotenv


class Gemini:
    """
    Wrapper around Gemini for text generation.
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

        response = self.model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
            )
        )

        text = response.text.strip()
        if isinstance(text, bytes):
            text = text.decode("utf-8", errors="replace")
        return text