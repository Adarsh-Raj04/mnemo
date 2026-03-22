from typing import List, Tuple
from app.core.providers.base import EmbedProvider


class OllamaEmbedProvider(EmbedProvider):

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def default_model(self) -> str:
        return "nomic-embed-text"

    def embed(self, texts: List[str]) -> List[List[float]]:
        import requests

        results = []
        for text in texts:
            res = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.default_model, "prompt": text},
                timeout=30,
            )
            results.append(res.json()["embedding"])
        return results

    def embed_query(self, text: str) -> List[float]:
        return self.embed([text])[0]

    def test_connection(self) -> Tuple[bool, str]:
        try:
            self.embed_query("test")
            return True, f"Ollama embeddings working with {self.default_model}."
        except Exception as e:
            return False, str(e)
