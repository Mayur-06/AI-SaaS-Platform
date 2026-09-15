from providers.base import BaseLLM
from openai import OpenAI


class OpenAIProvider(BaseLLM):

    def __init__(self, api_key: str, model_name: str = "gpt-4o-mini"):
        """Initializes the OpenAI client."""
        # Creates a client instance instead of configuring a global object
        self.client = OpenAI(api_key=api_key)
        self.model_name = model_name

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        """Generates text using the Chat Completions API API."""
        # Pass prompts as structured objects rather than a single merged string
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
        )

        # Extract and clean up the text response
        return response.choices[0].message.content.strip()
