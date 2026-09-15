from app.rag.embedder import Embedder
# from search_index import SearchIndex
from app.rag.generator import Generator
from app.rag.textchunker import TextChunker

class RAGPipeline:

    def __init__(
        self,
        embedder,
        faiss_manager,
        generator,
        chunker,
    ):

        self.embedder = embedder
        self.faiss_manager = faiss_manager
        self.chunker = chunker
        self.generator = generator

    def ask(self, question:str, user_memories: list[str] | None = None):

        query_embedding = self.embedder.encode(question)

        retrieved_chunks = self.faiss_manager.search(
            query_embedding,
            top_k=3,
        )

        context = "\n\n".join(
            chunk["text"] for chunk in retrieved_chunks
        )
        memory_block = "\n".join(f"- {m}" for m in user_memories) if user_memories else "None known yet."

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

6. Be conversational, concise, and helpful.

Known facts about this user:
{memory_block}
"""

        user_prompt = f"""
    Context:
    {context}

    Question:
    {question}
    """
        # generator = Generator(
        #     provider,
        #     api_key,
        # )
        answer = self.generator.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        return answer