from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from openai import OpenAI
import uuid
import os


def load_and_chunk(
    file_path: str, filename: str, chunk_size: int = 500, chunk_overlap: int = 50
):
    ext = os.path.splitext(filename)[1].lower()
    loader = (
        PyPDFLoader(file_path)
        if ext == ".pdf"
        else TextLoader(file_path, encoding="utf-8")
    )
    documents = loader.load()
    total_pages = len(documents)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap
    )
    chunks = splitter.split_documents(documents)
    return chunks, total_pages


def embed_and_store(chunks, filename: str, total_pages: int, user, api_key: str):
    from app.core.vector_store.factory import get_vector_store

    client = OpenAI(api_key=api_key)
    store = get_vector_store(user)
    texts = [c.page_content for c in chunks]
    metadatas = [
        {
            "filename": filename,
            "page": c.metadata.get("page", 0) + 1,
            "total_pages": total_pages,
        }
        for c in chunks
    ]
    ids = [str(uuid.uuid4()) for _ in chunks]
    response = client.embeddings.create(input=texts, model="text-embedding-3-small")
    embeddings = [r.embedding for r in response.data]
    store.store(user.id, texts, embeddings, metadatas, ids)
    return len(chunks)


def search_user_kb(query: str, user, api_key: str, n_results: int = 5):
    from app.core.vector_store.factory import get_vector_store

    client = OpenAI(api_key=api_key)
    store = get_vector_store(user)
    response = client.embeddings.create(input=[query], model="text-embedding-3-small")
    query_embedding = response.data[0].embedding
    return store.search(user.id, query_embedding, n_results)


def search_multiple_kbs(query: str, users: list, api_key: str, n_results: int = 5):
    """
    users can be a list of User objects OR user_id strings.
    Handles both for backwards compatibility.
    """
    from app.core.vector_store.factory import (
        get_vector_store,
        get_vector_store_from_config,
    )
    from app.core.vector_store.chroma import ChromaAdapter

    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(input=[query], model="text-embedding-3-small")
    query_embedding = response.data[0].embedding

    all_docs, all_metas = [], []

    for user in users:
        try:
            # Handle both User object and plain user_id string
            if isinstance(user, str):
                # Plain ID — use ChromaDB directly as fallback
                store = ChromaAdapter()
                user_id = user
            else:
                store = get_vector_store(user)
                user_id = user.id

            docs, metas = store.search(user_id, query_embedding, n_results)
            all_docs.extend(docs)
            all_metas.extend(metas)
        except Exception as e:
            uid = user if isinstance(user, str) else getattr(user, "id", "?")
            print(f"Search failed for user {uid}: {e}")
            continue

    return all_docs[:n_results], all_metas[:n_results]
