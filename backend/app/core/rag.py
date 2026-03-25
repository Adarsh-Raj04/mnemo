from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
import uuid
import os
from app.core.vector_store.factory import get_vector_store
from app.core.providers.factory import get_embed_provider
from app.core.vector_store.chroma import ChromaAdapter
import re

# Instruction patterns that pollute semantic search
_INSTRUCTION_PREFIXES = re.compile(
    r"^(please\s+|can you\s+|could you\s+|i want\s+|i need\s+|"
    r"tell me\s+|explain\s+|describe\s+|give me\s+|show me\s+|"
    r"answer (me\s+)?in \d+ words?\s*[-–]?\s*|"
    r"write\s+(a\s+)?\d+\s+word[s]?\s+(about\s+|on\s+)?|"
    r"in detail[,\s]+|briefly[,\s]+|summarize[,\s]+)",
    re.IGNORECASE,
)

_INSTRUCTION_SUFFIXES = re.compile(
    r"(\s+in \d+ words?|\s+briefly|\s+in detail|\s+with examples?"
    r"|\s+step by step|\s+for (a\s+)?(beginner|expert|student)s?)$",
    re.IGNORECASE,
)


def clean_search_query(question: str) -> str:
    """
    Extract the core semantic topic from a user question.
    Removes instruction words that pollute vector search.

    Examples:
    "Answer me in 1000 words - what is diabetes" → "what is diabetes"
    "Please explain photosynthesis in detail"     → "photosynthesis"
    "Give me a summary of machine learning"       → "machine learning"
    """
    q = question.strip()

    # Strip leading instruction phrases
    q = _INSTRUCTION_PREFIXES.sub("", q).strip()

    # Strip trailing instruction phrases
    q = _INSTRUCTION_SUFFIXES.sub("", q).strip()

    # Remove leading dash or colon left over after stripping
    q = re.sub(r"^[-–:,\s]+", "", q).strip()

    # Fall back to original if we stripped too much
    return q if len(q) >= 3 else question.strip()


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


def embed_and_store(chunks, filename: str, total_pages: int, user, api_key: str = None):
    from app.core.vector_store.factory import get_vector_store
    from app.core.providers.factory import get_embed_provider

    embed_provider = get_embed_provider(user)
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
    embeddings = embed_provider.embed(texts)

    store.store(user.id, texts, embeddings, metadatas, ids)
    return len(chunks)


def search_chunks(query: str, user, n_results: int = 5):
    """Search a single user's KB — returns (docs, metas)."""
    from app.core.vector_store.factory import get_vector_store
    from app.core.providers.factory import get_embed_provider

    embed_provider = get_embed_provider(user)
    store = get_vector_store(user)
    query_embedding = embed_provider.embed_query(query)
    return store.search(user.id, query_embedding, n_results)


def search_multiple_kbs(
    query: str, users: list, api_key: str = None, n_results: int = 5
):
    """
    Search across multiple users' KBs.
    users must be full User objects.
    """

    all_docs, all_metas = [], []

    for user in users:
        try:
            if isinstance(user, str):
                store = ChromaAdapter()
                user_id = user
                from openai import OpenAI

                client = OpenAI(api_key=api_key)
                resp = client.embeddings.create(
                    input=[query], model="text-embedding-3-small"
                )
                query_embedding = resp.data[0].embedding
            else:
                embed_provider = get_embed_provider(user)
                store = get_vector_store(user)
                user_id = user.id
                query_embedding = embed_provider.embed_query(query)

            docs, metas = store.search(user_id, query_embedding, n_results)
            all_docs.extend(docs)
            all_metas.extend(metas)
        except Exception as e:
            uid = user if isinstance(user, str) else getattr(user, "id", "?")
            print(f"Search failed for user {uid}: {e}")
            continue

    return all_docs[:n_results], all_metas[:n_results]
