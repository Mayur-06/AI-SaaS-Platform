from rag.embedder import Embedder
from rag.generator import Generator
from rag.textchunker import TextChunker


class RAGPipeline:

    def __init__(
        self,
        embedder,
        document_store,
        generator,
        chunker,
    ):

        self.embedder = embedder
        self.document_store = document_store
        self.chunker = chunker
        self.generator = generator

    def ask(self, question, organization_id=None):

        query_embedding = self.embedder.encode(question)

        retrieved_chunks = self.document_store.search(
            query_embedding,
            top_k=3,
        )

        context = "\n\n".join(
            chunk["text"] for chunk in retrieved_chunks
        )

        system_prompt = f"""
You are a helpful and conversational AI assistant.

You have access to documents uploaded by the user. Use the document
context when it is relevant to the user's question.

Follow these rules:

1. For casual conversation, greetings, small talk, or questions about
   yourself, respond naturally and helpfully. You do not need to use
   the document context for these questions.

2. If the user's question is related to the uploaded documents, use
   the provided context to answer accurately.

3. If the answer can be reasonably answered using general knowledge and
   the question is not specifically about the uploaded documents, you
   may answer using your general knowledge.

4. If the user asks for specific information about the uploaded
   documents and that information is not present in the provided
   context, say that you could not find that information in the
   uploaded documents. Do not invent or hallucinate information.

5. If the question is ambiguous, ask the user for clarification when
   appropriate.

6. Format your answer using clean, professional Markdown (use headings `###`, bullet points `-`, bold `**key terms**`, and inline `code` where appropriate). Be conversational, concise, and structured.
"""

        user_prompt = f"""
    Context:
    {context}

    Question:
    {question}
    """

        answer = self.generator.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        return {
            "answer": answer,
            "model": getattr(self.generator, "model_name", "unknown"),
            "provider": getattr(self.generator, "provider", "unknown"),
            "input_tokens": len(system_prompt.split()) + len(user_prompt.split()),
            "output_tokens": len(answer.split()),
            "latency_ms": 0,
        }