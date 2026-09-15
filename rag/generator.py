from app.rag.providers.gemini import Gemini
# from providers.openai import OpenAIProvider
# from providers.groq import GroqProvider
# from providers.claude import ClaudeProvider

# class Generator:

#     def __init__(self, provider, api_key):
#         provider = provider.lower()
#         if provider == "gemini":
#             self.client = Gemini(api_key)
#         elif provider == "openai":
#              self.client = OpenAIProvider(api_key)

#         elif provider.lower() == "groq":
#             self.client = GroqProvider(api_key)

#         elif provider.lower() == "claude":
#             self.client = ClaudeProvider(api_key)

#         else:
#             raise ValueError(f"Unsupported provider: {provider}")

#     def generate(
#         self,
#         system_prompt,
#         user_prompt,
#         temperature=0.2,
#     ):

#         return self.client.generate(
#             system_prompt,
#             user_prompt,
#             temperature,
#         )



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