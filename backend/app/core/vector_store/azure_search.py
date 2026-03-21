import uuid
from typing import List, Tuple
from app.core.vector_store.base import VectorStoreAdapter


class AzureSearchAdapter(VectorStoreAdapter):

    def __init__(self, config: dict):
        from azure.search.documents import SearchClient
        from azure.search.documents.indexes import SearchIndexClient
        from azure.core.credentials import AzureKeyCredential

        self.endpoint = config["endpoint"]
        self.index_name = config["index_name"]
        self.credential = AzureKeyCredential(config["admin_key"])

        self.client = SearchClient(
            endpoint=self.endpoint,
            index_name=self.index_name,
            credential=self.credential,
        )
        self.index_client = SearchIndexClient(
            endpoint=self.endpoint, credential=self.credential
        )
        self._ensure_index()

    def _ensure_index(self):
        from azure.search.documents.indexes.models import (
            SearchIndex,
            SimpleField,
            SearchableField,
            SearchField,
            SearchFieldDataType,
            VectorSearch,
            HnswAlgorithmConfiguration,
            VectorSearchProfile,
        )

        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SimpleField(
                name="user_id", type=SearchFieldDataType.String, filterable=True
            ),
            SimpleField(
                name="filename", type=SearchFieldDataType.String, filterable=True
            ),
            SimpleField(name="page", type=SearchFieldDataType.Int32),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchField(
                name="embedding",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,
                vector_search_profile_name="mnemo-profile",
            ),
        ]
        vector_search = VectorSearch(
            algorithms=[HnswAlgorithmConfiguration(name="mnemo-hnsw")],
            profiles=[
                VectorSearchProfile(
                    name="mnemo-profile", algorithm_configuration_name="mnemo-hnsw"
                )
            ],
        )
        index = SearchIndex(
            name=self.index_name, fields=fields, vector_search=vector_search
        )
        try:
            self.index_client.create_or_update_index(index)
        except Exception:
            pass

    def store(self, user_id, texts, embeddings, metadatas, ids):
        docs = [
            {
                "id": id_,
                "user_id": user_id,
                "filename": meta.get("filename", ""),
                "page": meta.get("page", 0),
                "content": text_,
                "embedding": emb,
            }
            for id_, text_, emb, meta in zip(ids, texts, embeddings, metadatas)
        ]
        self.client.upload_documents(documents=docs)

    def search(self, user_id, query_embedding, n_results=5):
        from azure.search.documents.models import VectorizedQuery

        vec_query = VectorizedQuery(
            vector=query_embedding, k_nearest_neighbors=n_results, fields="embedding"
        )
        results = self.client.search(
            search_text=None,
            vector_queries=[vec_query],
            filter=f"user_id eq '{user_id}'",
            top=n_results,
            select=["content", "filename", "page"],
        )
        texts, metadatas = [], []
        for r in results:
            texts.append(r["content"])
            metadatas.append({"filename": r["filename"], "page": r["page"]})
        return texts, metadatas

    def delete_document(self, user_id, filename):
        results = self.client.search(
            search_text="*",
            filter=f"user_id eq '{user_id}' and filename eq '{filename}'",
            select=["id"],
        )
        ids = [{"id": r["id"]} for r in results]
        if ids:
            self.client.delete_documents(documents=ids)
        return len(ids)

    def delete_collection(self, user_id):
        results = self.client.search(
            search_text="*", filter=f"user_id eq '{user_id}'", select=["id"]
        )
        ids = [{"id": r["id"]} for r in results]
        if ids:
            self.client.delete_documents(documents=ids)

    def get_all_documents(self, user_id):
        results = self.client.search(
            search_text="*",
            filter=f"user_id eq '{user_id}'",
            select=["filename", "page"],
            top=10000,
        )
        docs = {}
        for r in results:
            fn = r["filename"]
            if fn not in docs:
                docs[fn] = {"filename": fn, "pages": r["page"], "chunks": 0}
            docs[fn]["chunks"] += 1
        return list(docs.values())

    def get_document_chunks(self, user_id, filename):
        results = self.client.search(
            search_text="*",
            filter=f"user_id eq '{user_id}' and filename eq '{filename}'",
            select=["content", "page"],
            top=10000,
        )
        return [
            {"index": i, "text": r["content"], "page": r["page"]}
            for i, r in enumerate(results)
        ]

    def test_connection(self):
        try:
            self.index_client.list_indexes()
            return True, "Azure AI Search connection successful."
        except Exception as e:
            return False, str(e)

    def get_all_vectors(self, user_id: str):
        from azure.search.documents.models import VectorizedQuery

        results = self.client.search(
            search_text="*",
            filter=f"user_id eq '{user_id}'",
            select=["id", "content", "embedding", "filename", "page"],
            top=100000,
        )
        items = []
        for r in results:
            items.append(
                {
                    "id": r["id"],
                    "text": r["content"],
                    "embedding": r.get("embedding", []),
                    "metadata": {"filename": r["filename"], "page": r["page"]},
                }
            )
        return items

    def delete_by_ids(self, user_id: str, ids: list):
        if ids:
            self.client.delete_documents(documents=[{"id": id_} for id_ in ids])

    def count(self, user_id: str) -> int:
        results = self.client.search(
            search_text="*",
            filter=f"user_id eq '{user_id}'",
            select=["id"],
            top=1,
            include_total_count=True,
        )
        return results.get_count() or 0
