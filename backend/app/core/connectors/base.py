from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any


class DataSourceConnector(ABC):

    @abstractmethod
    def test_connection(self) -> Tuple[bool, str]:
        """Returns (success, message)"""
        pass

    @abstractmethod
    def list_sources(self) -> List[Dict[str, Any]]:
        """List available tables, folders, or files"""
        pass

    @abstractmethod
    def pull_data(self, source_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Pull data from selected sources.
        Returns list of {text, metadata} dicts ready for embedding.
        """
        pass

    @abstractmethod
    def serialize_to_text(self, row: Dict, columns: List[str]) -> str:
        """Convert a data row to natural language text for embedding"""
        pass
