from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional


class VectorStoreAdapter(ABC):

    @abstractmethod
    def store(self, user_id, texts, embeddings, metadatas, ids) -> None:
        pass

    @abstractmethod
    def search(
        self, user_id, query_embedding, n_results=5
    ) -> Tuple[List[str], List[dict]]:
        pass

    @abstractmethod
    def delete_document(self, user_id, filename) -> int:
        pass

    @abstractmethod
    def delete_collection(self, user_id) -> None:
        pass

    @abstractmethod
    def get_all_documents(self, user_id) -> List[dict]:
        pass

    @abstractmethod
    def get_document_chunks(self, user_id, filename) -> List[dict]:
        pass

    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        pass

    # ── Migration methods ──────────────────────────────────

    @abstractmethod
    def get_all_vectors(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Return all stored vectors for a user.
        Each item: { id, text, embedding, metadata }
        """
        pass

    @abstractmethod
    def delete_by_ids(self, user_id: str, ids: List[str]) -> None:
        """Delete specific vectors by ID — used for rollback."""
        pass

    @abstractmethod
    def count(self, user_id: str) -> int:
        """Return total vector count for a user."""
        pass
