

from groq import Groq

class GroqProvider:

    def __init__(
        self,
        api_key,
        model_name="llama-3.3-70b-versatile",
    ):

        self.client = Groq(api_key=api_key)
        self.model_name = model_name

    def generate(
        self,
        system_prompt,
        user_prompt,
        temperature=0.2,
    ):

        response = self.client.chat.completions.create(
            model=self.model_name,
            temperature=temperature,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
        )

        return response.choices[0].message.content.strip()