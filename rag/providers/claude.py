from providers.base import BaseLLM
from anthropic import Anthropic  # Run: pip install anthropic


class ClaudeProvider(BaseLLM):

    def __init__(self, api_key: str, model_name: str = "claude-3-5-sonnet-latest"):
        """Initializes the Anthropic Claude client."""
        # Creates an Anthropic client instance
        self.client = Anthropic(api_key=api_key)
        self.model_name = model_name

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        """Generates text using the Anthropic Messages API."""
        # Note: system prompt is a top-level argument, NOT inside messages
        response = self.client.messages.create(
            model=self.model_name,
            max_tokens=4096,  # Anthropic requires max_tokens to be explicitly set
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
        )

        # Extract and clean up the text response
        return response.content.text.strip()
