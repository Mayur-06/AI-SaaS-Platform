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

    def ask(self, question, organization_id=None, conversation_history=None):

        search_query = question
        if conversation_history:
            last_q = (conversation_history[-1].get("question") or conversation_history[-1].get("query") or "").strip()
            if last_q:
                referential_markers = {
                    "it", "they", "them", "this", "that", "these", "those",
                    "second", "third", "former", "latter", "previous", "above",
                    "same", "other", "another"
                }
                lower_q = question.lower().strip()
                import re
                words = set(re.findall(r"\b\w+\b", lower_q))
                has_pronoun = bool(words & referential_markers)
                has_phrase = any(
                    phrase in lower_q for phrase in [
                        "what about", "how about", "explain more", "tell me more",
                        "why is that", "what if", "can you clarify", "elaborate on"
                    ]
                )
                is_fragment = len(lower_q.split()) <= 3
                if has_pronoun or has_phrase or is_fragment:
                    search_query = f"{last_q} {question}"

        query_embedding = self.embedder.encode(search_query)

        retrieved_chunks = self.document_store.search(
            query_embedding,
            query_text=search_query,
            top_k=8,
        )

        context = "\n\n".join(
            chunk["text"] for chunk in retrieved_chunks
        )

        history_block = ""
        if conversation_history:
            turns = []
            for item in conversation_history[-3:]:
                q = (item.get("question") or item.get("query") or "").strip()
                a = (item.get("answer") or item.get("response") or "").strip()
                if q and a:
                    a_snippet = a[:400] + ("..." if len(a) > 400 else "")
                    turns.append(f"User: {q}\nAI: {a_snippet}")
            if turns:
                history_block = "Previous Conversation:\n" + "\n\n".join(turns) + "\n\n"

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
    {history_block}Context:
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