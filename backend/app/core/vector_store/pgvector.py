import uuid
import json
from typing import List, Tuple
from sqlalchemy import create_engine, text
from app.core.vector_store.base import VectorStoreAdapter


class PgVectorAdapter(VectorStoreAdapter):

    def __init__(self, config: dict):
        url = (
            f"postgresql://{config['user']}:{config['password']}"
            f"@{config['host']}:{config.get('port', 5432)}/{config['database']}"
        )
        self.engine = create_engine(url)
        self._ensure_table()

    def _ensure_table(self):
        with self.engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.execute(
                text(
                    """
                CREATE TABLE IF NOT EXISTS mnemo_vectors (
                    id          TEXT PRIMARY KEY,
                    user_id     TEXT NOT NULL,
                    filename    TEXT NOT NULL,
                    page        INTEGER,
                    chunk_index INTEGER,
                    content     TEXT NOT NULL,
                    embedding   vector(1536),
                    metadata    JSONB
                )
            """
                )
            )
            conn.execute(
                text(
                    """
                CREATE INDEX IF NOT EXISTS idx_mnemo_vectors_user
                ON mnemo_vectors(user_id)
            """
                )
            )
            conn.commit()

    def store(self, user_id, texts, embeddings, metadatas, ids):
        with self.engine.connect() as conn:
            for i, (text_, emb, meta, id_) in enumerate(
                zip(texts, embeddings, metadatas, ids)
            ):
                conn.execute(
                    text(
                        """
                    INSERT INTO mnemo_vectors
                        (id, user_id, filename, page, chunk_index, content, embedding, metadata)
                    VALUES
                        (:id, :user_id, :filename, :page, :chunk_index, :content, :embedding, :metadata)
                    ON CONFLICT (id) DO NOTHING
                """
                    ),
                    {
                        "id": id_,
                        "user_id": user_id,
                        "filename": meta.get("filename", ""),
                        "page": meta.get("page", 0),
                        "chunk_index": i,
                        "content": text_,
                        "embedding": str(emb),
                        "metadata": json.dumps(meta),
                    },
                )
            conn.commit()

    def search(self, user_id, query_embedding, n_results=5):
        with self.engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                SELECT content, metadata
                FROM   mnemo_vectors
                WHERE  user_id = :user_id
                ORDER BY embedding <=> :emb
                LIMIT  :n
            """
                ),
                {"user_id": user_id, "emb": str(query_embedding), "n": n_results},
            ).fetchall()
        texts = [r[0] for r in rows]
        metadatas = [json.loads(r[1]) for r in rows]
        return texts, metadatas

    def delete_document(self, user_id, filename):
        with self.engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                DELETE FROM mnemo_vectors
                WHERE user_id = :user_id AND filename = :filename
            """
                ),
                {"user_id": user_id, "filename": filename},
            )
            conn.commit()
            return result.rowcount

    def delete_collection(self, user_id):
        with self.engine.connect() as conn:
            conn.execute(
                text("DELETE FROM mnemo_vectors WHERE user_id = :uid"), {"uid": user_id}
            )
            conn.commit()

    def get_all_documents(self, user_id):
        with self.engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                SELECT filename, MAX(page) as pages, COUNT(*) as chunks
                FROM   mnemo_vectors
                WHERE  user_id = :uid
                GROUP BY filename
            """
                ),
                {"uid": user_id},
            ).fetchall()
        return [{"filename": r[0], "pages": r[1], "chunks": r[2]} for r in rows]

    def get_document_chunks(self, user_id, filename):
        with self.engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                SELECT chunk_index, content, page
                FROM   mnemo_vectors
                WHERE  user_id = :uid AND filename = :fn
                ORDER BY page, chunk_index
            """
                ),
                {"uid": user_id, "fn": filename},
            ).fetchall()
        return [{"index": r[0], "text": r[1], "page": r[2]} for r in rows]

    def test_connection(self):
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, "pgvector connection successful."
        except Exception as e:
            return False, str(e)

    def get_all_vectors(self, user_id: str):
        from sqlalchemy import text

        with self.engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                SELECT id, content, embedding::text, metadata
                FROM   mnemo_vectors
                WHERE  user_id = :uid
            """
                ),
                {"uid": user_id},
            ).fetchall()
        import json

        items = []
        for r in rows:
            emb = [float(x) for x in r[2].strip("[]").split(",")]
            items.append(
                {
                    "id": r[0],
                    "text": r[1],
                    "embedding": emb,
                    "metadata": json.loads(r[3]),
                }
            )
        return items

    def delete_by_ids(self, user_id: str, ids: list):
        from sqlalchemy import text

        if not ids:
            return
        placeholders = ", ".join([f":id_{i}" for i in range(len(ids))])
        params = {f"id_{i}": id_ for i, id_ in enumerate(ids)}
        with self.engine.connect() as conn:
            conn.execute(
                text(
                    f"""
                DELETE FROM mnemo_vectors
                WHERE user_id = :uid AND id IN ({placeholders})
            """
                ),
                {"uid": user_id, **params},
            )
            conn.commit()

    def count(self, user_id: str) -> int:
        from sqlalchemy import text

        with self.engine.connect() as conn:
            return conn.execute(
                text("SELECT COUNT(*) FROM mnemo_vectors WHERE user_id = :uid"),
                {"uid": user_id},
            ).scalar()
