#schema
from pydantic import BaseModel

class ChatRequest(BaseModel):
    question: str
    # provider: str
    # api_key: str


class ChatResponse(BaseModel):
    answer: str


class HealthResponse(BaseModel):
    status: str