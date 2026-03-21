import chromadb
import os
from typing import List, Tuple
from app.core.vector_store.base import VectorStoreAdapter

CHROMA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "chroma_db"
)


class ChromaAdapter(VectorStoreAdapter):

    def __init__(self):
        self.client = chromadb.PersistentClient(path=CHROMA_PATH)

    def _collection(self, user_id: str):
        return self.client.get_or_create_collection(
            name=f"user_{user_id}", metadata={"hnsw:space": "cosine"}
        )

    def store(self, user_id, texts, embeddings, metadatas, ids):
        self._collection(user_id).add(
            documents=texts, embeddings=embeddings, metadatas=metadatas, ids=ids
        )

    def search(self, user_id, query_embedding, n_results=5):
        results = self._collection(user_id).query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas"],
        )
        return results["documents"][0], results["metadatas"][0]

    def delete_document(self, user_id, filename):
        col = self._collection(user_id)
        results = col.get(include=["metadatas"])
        ids = [
            results["ids"][i]
            for i, m in enumerate(results["metadatas"])
            if m.get("filename") == filename
        ]
        if ids:
            col.delete(ids=ids)
        return len(ids)

    def delete_collection(self, user_id):
        try:
            self.client.delete_collection(f"user_{user_id}")
        except Exception:
            pass

    def get_all_documents(self, user_id):
        results = self._collection(user_id).get(include=["metadatas"])
        docs = {}
        for meta in results["metadatas"]:
            fname = meta.get("filename", "unknown")
            if fname not in docs:
                docs[fname] = {
                    "filename": fname,
                    "pages": meta.get("total_pages", "?"),
                    "chunks": 0,
                }
            docs[fname]["chunks"] += 1
        return list(docs.values())

    def get_document_chunks(self, user_id, filename):
        results = self._collection(user_id).get(include=["documents", "metadatas"])
        chunks = []
        for i, meta in enumerate(results["metadatas"]):
            if meta.get("filename") == filename:
                chunks.append(
                    {
                        "index": len(chunks),
                        "text": results["documents"][i],
                        "page": meta.get("page", "?"),
                    }
                )
        return sorted(chunks, key=lambda c: (c["page"], c["index"]))

    def test_connection(self):
        try:
            self.client.list_collections()
            return True, "ChromaDB is working correctly."
        except Exception as e:
            return False, str(e)

    def get_all_vectors(self, user_id: str):
        col = self._collection(user_id)
        results = col.get(include=["documents", "metadatas", "embeddings"])
        items = []
        for i, id_ in enumerate(results["ids"]):
            items.append(
                {
                    "id": id_,
                    "text": results["documents"][i],
                    "embedding": results["embeddings"][i],
                    "metadata": results["metadatas"][i],
                }
            )
        return items

    def delete_by_ids(self, user_id: str, ids: list):
        if ids:
            self._collection(user_id).delete(ids=ids)

    def count(self, user_id: str) -> int:
        return self._collection(user_id).count()
