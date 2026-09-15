from rag.providers.gemini import Gemini
from rag.providers.openai import OpenAIProvider
from rag.providers.groq import GroqProvider
from rag.providers.claude import ClaudeProvider


class Generator:

    def __init__(self):
        self.client = Gemini()

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:

        return self.client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
        )