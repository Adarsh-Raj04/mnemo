from typing import List, Tuple
from app.core.providers.base import EmbedProvider


class GeminiEmbedProvider(EmbedProvider):

    def __init__(self, api_key: str):
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self.genai = genai

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def default_model(self) -> str:
        return "models/text-embedding-004"

    def embed(self, texts: List[str]) -> List[List[float]]:
        results = []
        for text in texts:
            result = self.genai.embed_content(
                model=self.default_model, content=text, task_type="retrieval_document"
            )
            results.append(result["embedding"])
        return results

    def embed_query(self, text: str) -> List[float]:
        result = self.genai.embed_content(
            model=self.default_model, content=text, task_type="retrieval_query"
        )
        return result["embedding"]

    def test_connection(self) -> Tuple[bool, str]:
        try:
            self.embed_query("test")
            return True, "Gemini embeddings working."
        except Exception as e:
            return False, str(e)
