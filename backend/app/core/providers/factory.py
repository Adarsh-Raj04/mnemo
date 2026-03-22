from app.core.providers.base import LLMProvider, EmbedProvider
from app.core.security import decrypt_api_key


def get_llm_provider(user) -> LLMProvider:
    """Return the correct LLM provider for a user."""
    provider = getattr(user, "chat_provider", "openai") or "openai"

    if provider == "anthropic":
        from app.core.providers.llm.anthropic_llm import AnthropicLLMProvider

        if not user.anthropic_key_enc:
            raise ValueError("Anthropic API key not set. Please add it in Settings.")
        return AnthropicLLMProvider(decrypt_api_key(user.anthropic_key_enc))

    elif provider == "gemini":
        from app.core.providers.llm.gemini_llm import GeminiLLMProvider

        if not user.gemini_key_enc:
            raise ValueError("Gemini API key not set. Please add it in Settings.")
        return GeminiLLMProvider(decrypt_api_key(user.gemini_key_enc))

    elif provider == "ollama":
        from app.core.providers.llm.ollama_llm import OllamaLLMProvider

        base_url = getattr(user, "ollama_base_url", None) or "http://localhost:11434"
        return OllamaLLMProvider(base_url)

    else:
        from app.core.providers.llm.openai_llm import OpenAILLMProvider

        if not user.openai_api_key_encrypted:
            raise ValueError("OpenAI API key not set. Please add it in Settings.")
        return OpenAILLMProvider(decrypt_api_key(user.openai_api_key_encrypted))


def get_embed_provider(user) -> EmbedProvider:
    """Return the correct embedding provider for a user."""
    provider = getattr(user, "embed_provider", "openai") or "openai"

    if provider == "gemini":
        from app.core.providers.embed.gemini_embed import GeminiEmbedProvider

        if not user.gemini_key_enc:
            raise ValueError("Gemini API key not set. Please add it in Settings.")
        return GeminiEmbedProvider(decrypt_api_key(user.gemini_key_enc))

    elif provider == "ollama":
        from app.core.providers.embed.ollama_embed import OllamaEmbedProvider

        base_url = getattr(user, "ollama_base_url", None) or "http://localhost:11434"
        return OllamaEmbedProvider(base_url)

    else:
        from app.core.providers.embed.openai_embed import OpenAIEmbedProvider

        if not user.openai_api_key_encrypted:
            raise ValueError("OpenAI API key not set. Please add it in Settings.")
        return OpenAIEmbedProvider(decrypt_api_key(user.openai_api_key_encrypted))


def get_provider_display_name(provider: str, model: str) -> str:
    """Human readable name for status messages."""
    names = {
        "openai": "OpenAI",
        "anthropic": "Claude",
        "gemini": "Gemini",
        "ollama": "Ollama",
    }
    return f"{names.get(provider, provider)} ({model})"
