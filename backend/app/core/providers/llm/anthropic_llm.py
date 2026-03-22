from typing import Iterator, List, Tuple
from app.core.providers.base import LLMProvider


class AnthropicLLMProvider(LLMProvider):

    def __init__(self, api_key: str):
        import anthropic

        self.client = anthropic.Anthropic(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def available_models(self) -> List[str]:
        return [
            "claude-opus-4-5",
            "claude-sonnet-4-5",
            "claude-haiku-4-5",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ]

    def stream(
        self, system_prompt: str, user_message: str, model: str
    ) -> Iterator[str]:
        with self.client.messages.stream(
            model=model or "claude-sonnet-4-5",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            for text in stream.text_stream:
                yield text

    def test_connection(self) -> Tuple[bool, str]:
        try:
            self.client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=10,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True, "Anthropic connection successful."
        except Exception as e:
            return False, str(e)
