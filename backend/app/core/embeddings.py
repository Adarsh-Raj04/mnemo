import chromadb
import os

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "chroma_db")


def get_chroma_client():
    return chromadb.PersistentClient(path=CHROMA_PATH)


def get_user_collection(user_id: str):
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=f"user_{user_id}", metadata={"hnsw:space": "cosine"}
    )
    return collection


def get_all_user_documents(user_id: str):
    collection = get_user_collection(user_id)
    results = collection.get(include=["metadatas"])
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


def delete_user_document(user_id: str, filename: str):
    collection = get_user_collection(user_id)
    results = collection.get(include=["metadatas"])
    ids_to_delete = [
        results["ids"][i]
        for i, meta in enumerate(results["metadatas"])
        if meta.get("filename") == filename
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    return len(ids_to_delete)


def delete_user_collection(user_id: str):
    client = get_chroma_client()
    try:
        client.delete_collection(f"user_{user_id}")
    except Exception:
        pass
