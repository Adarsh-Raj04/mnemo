from typing import Iterator, List, Tuple
from app.core.providers.base import LLMProvider


class OllamaLLMProvider(LLMProvider):

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def available_models(self) -> List[str]:
        try:
            import requests

            res = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if res.status_code == 200:
                return [m["name"] for m in res.json().get("models", [])]
        except Exception:
            pass
        return ["llama3.2", "mistral", "phi3", "qwen2.5"]

    def stream(
        self, system_prompt: str, user_message: str, model: str
    ) -> Iterator[str]:
        import requests, json

        payload = {
            "model": model or "llama3.2",
            "stream": True,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        }
        with requests.post(
            f"{self.base_url}/api/chat", json=payload, stream=True, timeout=120
        ) as resp:
            for line in resp.iter_lines():
                if line:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if data.get("done"):
                        break

    def test_connection(self) -> Tuple[bool, str]:
        try:
            import requests

            res = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if res.status_code == 200:
                models = [m["name"] for m in res.json().get("models", [])]
                return True, f"Ollama connected. Models: {', '.join(models[:3])}"
            return False, f"Ollama returned {res.status_code}"
        except Exception:
            return False, (
                f"Cannot reach Ollama at {self.base_url}. "
                "Make sure Ollama is running on the same machine as your Mnemo server. "
                "If using hosted Mnemo, Ollama is not supported — use OpenAI, Claude, or Gemini."
            )
