from abc import ABC, abstractmethod
from typing import Iterator, List, Tuple


class LLMProvider(ABC):
    """Abstract base for all chat/completion providers."""

    @abstractmethod
    def stream(
        self,
        system_prompt: str,
        user_message: str,
        model: str,
    ) -> Iterator[str]:
        """Yield tokens one by one."""
        pass

    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def available_models(self) -> List[str]:
        pass


class EmbedProvider(ABC):
    """Abstract base for all embedding providers."""

    @abstractmethod
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Return embeddings for a list of texts."""
        pass

    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Return embedding for a single query."""
        pass

    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        pass
