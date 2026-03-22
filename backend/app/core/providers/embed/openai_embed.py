from typing import List, Tuple
from openai import OpenAI
from app.core.providers.base import EmbedProvider


class OpenAIEmbedProvider(EmbedProvider):

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def default_model(self) -> str:
        return "text-embedding-3-small"

    def embed(self, texts: List[str]) -> List[List[float]]:
        response = self.client.embeddings.create(input=texts, model=self.default_model)
        return [r.embedding for r in response.data]

    def embed_query(self, text: str) -> List[float]:
        return self.embed([text])[0]

    def test_connection(self) -> Tuple[bool, str]:
        try:
            self.embed(["test"])
            return True, "OpenAI embeddings working."
        except Exception as e:
            return False, str(e)
