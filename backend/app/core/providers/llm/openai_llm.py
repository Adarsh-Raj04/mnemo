from typing import Iterator, List, Tuple
from openai import OpenAI
from app.core.providers.base import LLMProvider


class OpenAILLMProvider(LLMProvider):

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def available_models(self) -> List[str]:
        return [
            "gpt-3.5-turbo",
            "gpt-4",
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4.1-nano",
        ]

    def stream(
        self, system_prompt: str, user_message: str, model: str
    ) -> Iterator[str]:
        response = self.client.chat.completions.create(
            model=model or "gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
            stream=True,
        )
        for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    def test_connection(self) -> Tuple[bool, str]:
        try:
            self.client.models.list()
            return True, "OpenAI connection successful."
        except Exception as e:
            return False, str(e)
