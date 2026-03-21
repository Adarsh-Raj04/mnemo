from typing import List, Tuple
from app.core.vector_store.base import VectorStoreAdapter


class PineconeAdapter(VectorStoreAdapter):

    def __init__(self, config: dict):
        from pinecone import Pinecone

        self.pc = Pinecone(api_key=config["api_key"])
        self.index_name = config["index_name"]
        self.index = self.pc.Index(self.index_name)

    def _namespace(self, user_id: str) -> str:
        return f"user_{user_id}"

    def store(self, user_id, texts, embeddings, metadatas, ids):
        vectors = [
            {"id": id_, "values": emb, "metadata": {**meta, "text": text_}}
            for id_, emb, meta, text_ in zip(ids, embeddings, metadatas, texts)
        ]
        self.index.upsert(vectors=vectors, namespace=self._namespace(user_id))

    def search(self, user_id, query_embedding, n_results=5):
        results = self.index.query(
            vector=query_embedding,
            top_k=n_results,
            namespace=self._namespace(user_id),
            include_metadata=True,
        )
        texts = [m["metadata"].get("text", "") for m in results["matches"]]
        metadatas = [
            {k: v for k, v in m["metadata"].items() if k != "text"}
            for m in results["matches"]
        ]
        return texts, metadatas

    def delete_document(self, user_id, filename):
        results = self.index.query(
            vector=[0.0] * 1536,
            top_k=10000,
            namespace=self._namespace(user_id),
            filter={"filename": {"$eq": filename}},
            include_metadata=False,
        )
        ids = [m["id"] for m in results["matches"]]
        if ids:
            self.index.delete(ids=ids, namespace=self._namespace(user_id))
        return len(ids)

    def delete_collection(self, user_id):
        self.index.delete(delete_all=True, namespace=self._namespace(user_id))

    def get_all_documents(self, user_id):
        stats = self.index.describe_index_stats()
        ns = stats.get("namespaces", {}).get(self._namespace(user_id), {})
        return [{"filename": "Pinecone namespace", "chunks": ns.get("vector_count", 0)}]

    def get_document_chunks(self, user_id, filename):
        results = self.index.query(
            vector=[0.0] * 1536,
            top_k=1000,
            namespace=self._namespace(user_id),
            filter={"filename": {"$eq": filename}},
            include_metadata=True,
        )
        return [
            {
                "index": i,
                "text": m["metadata"].get("text", ""),
                "page": m["metadata"].get("page", "?"),
            }
            for i, m in enumerate(results["matches"])
        ]

    def test_connection(self):
        try:
            self.pc.list_indexes()
            return True, "Pinecone connection successful."
        except Exception as e:
            return False, str(e)

    def get_all_vectors(self, user_id: str):
        """
        Pinecone doesn't support fetching all vectors with values directly.
        We fetch IDs first then fetch in batches.
        """
        ns = self._namespace(user_id)
        results = self.index.query(
            vector=[0.0] * 1536,
            top_k=10000,
            namespace=ns,
            include_metadata=True,
            include_values=True,
        )
        items = []
        for m in results["matches"]:
            items.append(
                {
                    "id": m["id"],
                    "text": m["metadata"].get("text", ""),
                    "embedding": m["values"],
                    "metadata": {k: v for k, v in m["metadata"].items() if k != "text"},
                }
            )
        return items

    def delete_by_ids(self, user_id: str, ids: list):
        if ids:
            self.index.delete(ids=ids, namespace=self._namespace(user_id))

    def count(self, user_id: str) -> int:
        stats = self.index.describe_index_stats()
        ns = stats.get("namespaces", {}).get(self._namespace(user_id), {})
        return ns.get("vector_count", 0)
