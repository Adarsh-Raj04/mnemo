from openai import OpenAI
import json

DEFAULT_SYSTEM_PROMPT = """You are a helpful personal knowledge assistant.
Answer the user's question based ONLY on the context provided below.
If the answer is not in the context, say "I couldn't find that in your documents."
Always be concise and clear."""


def resolve_system_prompt(user, db, source_id: str = None) -> str:
    """
    Priority: per-source prompt > global user prompt > default
    """
    from app.models import SystemPrompt, SystemPromptScopeEnum

    # Try per-source prompt first
    if source_id:
        source_prompt = (
            db.query(SystemPrompt)
            .filter(
                SystemPrompt.user_id == user.id,
                SystemPrompt.scope == SystemPromptScopeEnum.source,
                SystemPrompt.source_id == source_id,
            )
            .first()
        )
        if source_prompt:
            return source_prompt.prompt_text

    # Try global user prompt
    global_prompt = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.global_,
        )
        .first()
    )
    if global_prompt:
        return global_prompt.prompt_text

    return DEFAULT_SYSTEM_PROMPT


def build_prompt(query: str, context_chunks: list, system_prompt: str) -> tuple:
    context = "\n\n---\n\n".join(context_chunks)
    user_message = f"""Context:
{context}

Question: {query}
Answer:"""
    return system_prompt, user_message


def get_answer(
    query, context_chunks, metadatas, api_key, model="gpt-3.5-turbo", system_prompt=None
):
    client = OpenAI(api_key=api_key)

    if not system_prompt:
        system_prompt = DEFAULT_SYSTEM_PROMPT

    sp, user_msg = build_prompt(query, context_chunks, system_prompt)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": sp},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )
    answer = response.choices[0].message.content

    sources = []
    seen = set()
    for meta in metadatas:
        key = (meta.get("filename"), meta.get("page"))
        if key not in seen:
            seen.add(key)
            sources.append(
                {
                    "filename": meta.get("filename", "unknown"),
                    "page": meta.get("page", "?"),
                }
            )

    return answer, json.dumps(sources)


def generate_session_title(
    first_message: str, api_key: str, model: str = "gpt-3.5-turbo"
) -> str:
    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Generate a creative, concise 2-4 word title for a chat session "
                        f"that starts with this message: '{first_message}'. "
                        f"Reply with ONLY the title, no punctuation, no quotes."
                    ),
                }
            ],
            max_tokens=20,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return first_message[:40]
