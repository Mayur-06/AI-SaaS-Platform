# from typing import TypedDict
# from langgraph.graph import StateGraph, END
# from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
# from langchain_community.vectorstores import SupabaseVectorStore
# from supabase import create_client

# class ChatState(TypedDict):
#     user_id: str
#     question: str
#     memories: list[str]
#     document_context: str
#     answer: str
#     should_save: bool
#     fact_to_save: str

# supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
# embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
# llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash")

# vector_store = SupabaseVectorStore(
#     client=supabase_client,
#     embedding=embeddings,
#     table_name="user_memories",
#     query_name="match_user_memories",  # a Postgres function, see below
# )

# def fetch_memories(state: ChatState) -> ChatState:
#     results = vector_store.similarity_search(
#         state["question"], k=3,
#         filter={"user_id": state["user_id"]},
#     )
#     state["memories"] = [r.page_content for r in results]
#     return state

# def generate_chat(state: ChatState) -> ChatState:
#     prompt = f"""
# User's known facts/preferences: {state['memories']}
# Document context: {state['document_context']}
# Question: {state['question']}
# """
#     state["answer"] = llm.invoke(prompt).content
#     return state


# def evaluate_memory(state: ChatState) -> ChatState:
#     eval_prompt = f"""
# Did the user share a durable personal fact/preference (not a one-off question)?
# Message: {state['question']}
# Answer strictly JSON: {{"should_save": bool, "fact": "extracted fact or empty string"}}
# """
#     result = llm.invoke(eval_prompt).content
#     parsed = json.loads(result)
#     state["should_save"] = parsed["should_save"]
#     state["fact_to_save"] = parsed.get("fact", "")
#     return state

# def route_after_eval(state: ChatState) -> str:
#     return "save_memory" if state["should_save"] else END


# def save_memory(state: ChatState) -> ChatState:
#     vector_store.add_texts(
#         [state["fact_to_save"]],
#         metadatas=[{"user_id": state["user_id"]}],
#     )
#     return state

# graph = StateGraph(ChatState)
# graph.add_node("fetch_memories", fetch_memories)
# graph.add_node("generate_chat", generate_chat)
# graph.add_node("evaluate_memory", evaluate_memory)
# graph.add_node("save_memory", save_memory)

# graph.set_entry_point("fetch_memories")
# graph.add_edge("fetch_memories", "generate_chat")
# graph.add_edge("generate_chat", "evaluate_memory")
# graph.add_conditional_edges("evaluate_memory", route_after_eval, {
#     "save_memory": "save_memory",
#     END: END,
# })
# graph.add_edge("save_memory", END)

# app_graph = graph.compile()