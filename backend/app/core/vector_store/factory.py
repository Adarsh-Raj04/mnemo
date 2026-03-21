import json
from app.core.security import decrypt_api_key
from app.core.vector_store.base import VectorStoreAdapter
from app.core.vector_store.chroma import ChromaAdapter


def get_vector_store(user, db=None) -> VectorStoreAdapter:
    """
    Returns the correct VectorStoreAdapter for a user.
    Falls back to ChromaDB if no config exists.
    """
    # Fix — vector_config is a list due to backref, get first item
    config_list = getattr(user, "vector_config", None)

    if not config_list:
        return ChromaAdapter()

    # Handle both list (backref) and single object cases
    if isinstance(config_list, list):
        if not config_list:
            return ChromaAdapter()
        config_row = config_list[0]
    else:
        config_row = config_list

    if not config_row or not config_row.is_active:
        return ChromaAdapter()

    store_type = config_row.store_type

    if store_type == "chroma" or not config_row.config_encrypted:
        return ChromaAdapter()

    try:
        config = json.loads(decrypt_api_key(config_row.config_encrypted))
    except Exception:
        return ChromaAdapter()

    if store_type == "pgvector":
        from app.core.vector_store.pgvector import PgVectorAdapter

        return PgVectorAdapter(config)

    elif store_type == "pinecone":
        from app.core.vector_store.pinecone import PineconeAdapter

        return PineconeAdapter(config)

    elif store_type == "azure_search":
        from app.core.vector_store.azure_search import AzureSearchAdapter

        return AzureSearchAdapter(config)

    return ChromaAdapter()


def get_vector_store_from_config(store_type: str, config: dict) -> VectorStoreAdapter:
    """
    Used for test connection — builds adapter directly from raw config
    without needing a user object.
    """
    if store_type == "chroma":
        return ChromaAdapter()
    elif store_type == "pgvector":
        from app.core.vector_store.pgvector import PgVectorAdapter

        return PgVectorAdapter(config)
    elif store_type == "pinecone":
        from app.core.vector_store.pinecone import PineconeAdapter

        return PineconeAdapter(config)
    elif store_type == "azure_search":
        from app.core.vector_store.azure_search import AzureSearchAdapter

        return AzureSearchAdapter(config)
    raise ValueError(f"Unknown store type: {store_type}")
