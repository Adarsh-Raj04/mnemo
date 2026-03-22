from typing import Iterator, List, Tuple
from app.core.providers.base import LLMProvider


class GeminiLLMProvider(LLMProvider):

    def __init__(self, api_key: str):
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self.genai = genai

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def available_models(self) -> List[str]:
        return [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ]

    def stream(
        self, system_prompt: str, user_message: str, model: str
    ) -> Iterator[str]:
        gemini_model = self.genai.GenerativeModel(
            model_name=model or "gemini-2.0-flash",
            system_instruction=system_prompt,
        )
        response = gemini_model.generate_content(
            user_message, stream=True, generation_config={"temperature": 0.2}
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text

    def test_connection(self) -> Tuple[bool, str]:
        try:
            model = self.genai.GenerativeModel("gemini-2.0-flash")
            model.generate_content("hi")
            return True, "Gemini connection successful."
        except Exception as e:
            return False, str(e)
