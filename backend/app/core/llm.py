import json
from typing import Iterator, Generator
from app.core.providers.base import LLMProvider

DEFAULT_SYSTEM_PROMPT = """You are a helpful personal knowledge assistant.
Answer the user's question based ONLY on the context provided below.
If the answer is not in the context, say "I couldn't find that in your documents."
Always be concise and clear."""


def resolve_system_prompt(user, db, source_id: str = None) -> str:
    from app.models import SystemPrompt, SystemPromptScopeEnum

    if source_id:
        sp = (
            db.query(SystemPrompt)
            .filter(
                SystemPrompt.user_id == user.id,
                SystemPrompt.scope == SystemPromptScopeEnum.source,
                SystemPrompt.source_id == source_id,
            )
            .first()
        )
        if sp:
            return sp.prompt_text
    gp = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.global_,
        )
        .first()
    )
    return gp.prompt_text if gp else DEFAULT_SYSTEM_PROMPT


def build_user_message(query: str, context_chunks: list) -> str:
    context = "\n\n---\n\n".join(context_chunks)
    return f"""Context:
{context}

Question: {query}
Answer:"""


def stream_answer(
    query: str,
    context_chunks: list,
    metadatas: list,
    llm_provider: LLMProvider,
    model: str,
    system_prompt: str = None,
) -> Generator[dict, None, None]:
    """
    Yields SSE-ready dicts:
      {"type": "token",   "content": "..."}
      {"type": "sources", "content": [...]}
      {"type": "done"}
    """
    if not system_prompt:
        system_prompt = DEFAULT_SYSTEM_PROMPT

    user_message = build_user_message(query, context_chunks)
    full_answer = []

    for token in llm_provider.stream(system_prompt, user_message, model):
        full_answer.append(token)
        yield {"type": "token", "content": token}

    # Build sources
    sources = []
    seen = set()
    for meta in metadatas:
        key = (meta.get("filename"), meta.get("page"))
        if key not in seen:
            seen.add(key)
            sources.append(
                {"filename": meta.get("filename", "?"), "page": meta.get("page", "?")}
            )

    yield {"type": "sources", "content": sources}
    yield {
        "type": "done",
        "answer": "".join(full_answer),
        "sources": json.dumps(sources),
    }


def generate_session_title(
    first_message: str, llm_provider: LLMProvider, model: str
) -> str:
    try:
        tokens = list(
            llm_provider.stream(
                system_prompt="You generate very short chat titles.",
                user_message=(
                    f"Generate a creative 2-4 word title for a chat that starts with: "
                    f"'{first_message}'. Reply with ONLY the title, no punctuation, no quotes."
                ),
                model=model,
            )
        )
        return "".join(tokens).strip()[:60]
    except Exception:
        return first_message[:50]
