import time
import logging
from typing import Dict, Any
from ai_service.services.model_router import ModelRouter

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, organization=None):
        self.router = ModelRouter(organization)

    def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.2, target_model: str = None) -> Dict[str, Any]:
        start = time.time()
        result = self.router.generate(system_prompt, user_prompt, temperature, target_model=target_model)
        result["start_time"] = start
        return result
