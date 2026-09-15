from abc import ABC, abstractmethod

class BaseLLM(ABC):

    @abstractmethod
    def generate(
        self,
        system_prompt,
        user_prompt,
        temperature: float = 0.2,
    ):
        pass