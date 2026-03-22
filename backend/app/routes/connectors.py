import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, DataSourceConnection
from app.dependencies import get_verified_user
from app.core.security import encrypt_api_key, decrypt_api_key
from app.core.connectors.sql_connector import SQLConnector
from app.core.connectors.google_drive import (
    GoogleDriveConnector,
    get_gdrive_auth_url,
    exchange_code_for_tokens,
)

router = APIRouter(prefix="/connectors", tags=["connectors"])

STORAGE_LIMIT_BYTES = 50 * 1024 * 1024  # 50MB hard stop
STORAGE_WARN_BYTES = 40 * 1024 * 1024  # 40MB warning


def _check_storage(user_id: str, db: Session):
    from app.models import StorageUsage

    usage = db.query(StorageUsage).filter(StorageUsage.user_id == user_id).first()
    if not usage:
        return 0, 0
    return usage.original_bytes, usage.text_bytes


def _update_storage(user_id: str, db: Session, add_original: int, add_text: int):
    from app.models import StorageUsage

    usage = db.query(StorageUsage).filter(StorageUsage.user_id == user_id).first()
    if not usage:
        usage = StorageUsage(
            id=str(uuid.uuid4()), user_id=user_id, original_bytes=0, text_bytes=0
        )
        db.add(usage)
    usage.original_bytes += add_original
    usage.text_bytes += add_text
    usage.last_calculated = datetime.now(timezone.utc)
    db.commit()
    return usage.original_bytes, usage.text_bytes


@router.post("/test")
def test_connector(payload: dict, current_user: User = Depends(get_verified_user)):
    source_type = payload.get("source_type")
    config = payload.get("config", {})

    try:
        if source_type == "sql":
            connector = SQLConnector(config)
        elif source_type == "google_drive":
            connector = GoogleDriveConnector(config)
        else:
            raise HTTPException(status_code=400, detail="Unknown source type")

        success, message = connector.test_connection()
        return {"success": success, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/connect")
def connect_source(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    source_type = payload.get("source_type")
    name = payload.get("name", source_type)
    config = payload.get("config", {})

    # Test first
    try:
        if source_type == "sql":
            connector = SQLConnector(config)
        elif source_type == "google_drive":
            connector = GoogleDriveConnector(config)
        else:
            raise HTTPException(status_code=400, detail="Unknown source type")

        success, message = connector.test_connection()
        if not success:
            raise HTTPException(status_code=400, detail=f"Connection failed: {message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    encrypted = encrypt_api_key(json.dumps(config))

    connection = DataSourceConnection(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        source_type=source_type,
        name=name,
        config_encrypted=encrypted,
        status="connected",
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return {
        "id": connection.id,
        "name": connection.name,
        "source_type": connection.source_type,
        "status": connection.status,
        "message": "Connected successfully",
    }


@router.get("/")
def list_connections(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    connections = (
        db.query(DataSourceConnection)
        .filter(DataSourceConnection.user_id == current_user.id)
        .all()
    )
    return [
        {
            "id": c.id,
            "name": c.name,
            "source_type": c.source_type,
            "status": c.status,
            "last_synced": str(c.last_synced) if c.last_synced else None,
            "doc_count": c.doc_count,
            "original_bytes": c.original_bytes,
        }
        for c in connections
    ]


@router.get("/sql/tables/{connection_id}")
def list_sql_tables(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    conn = (
        db.query(DataSourceConnection)
        .filter(
            DataSourceConnection.id == connection_id,
            DataSourceConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    config = json.loads(decrypt_api_key(conn.config_encrypted))
    connector = SQLConnector(config)
    tables = connector.list_sources()
    return {"tables": tables}


@router.get("/gdrive/files/{connection_id}")
def list_gdrive_files(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    conn = (
        db.query(DataSourceConnection)
        .filter(
            DataSourceConnection.id == connection_id,
            DataSourceConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    config = json.loads(decrypt_api_key(conn.config_encrypted))
    connector = GoogleDriveConnector(config)
    files = connector.list_sources()
    return {"files": files}


@router.post("/{connection_id}/sync")
def sync_connection(
    connection_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    from app.core.security import decrypt_api_key
    from app.core.rag import load_and_chunk, embed_and_store
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from openai import OpenAI
    import uuid as uuid_mod

    conn = (
        db.query(DataSourceConnection)
        .filter(
            DataSourceConnection.id == connection_id,
            DataSourceConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Check storage limit
    # In the sync_connection endpoint, replace the storage check with:
    from app.routes.documents import is_using_own_vector_store

    if not is_using_own_vector_store(current_user):
        orig_bytes, text_bytes = _check_storage(current_user.id, db)
        if orig_bytes >= STORAGE_LIMIT_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Storage limit reached (50MB). Connect your own vector store to remove this limit.",
            )

    config = json.loads(decrypt_api_key(conn.config_encrypted))
    source_ids = payload.get("source_ids", [])
    custom_query = payload.get("custom_query", None)

    if not current_user.openai_api_key_encrypted:
        raise HTTPException(
            status_code=400, detail="Please add your OpenAI API key in Settings first"
        )
    api_key = decrypt_api_key(current_user.openai_api_key_encrypted)

    # Pull data
    try:
        if conn.source_type == "sql":
            connector = SQLConnector(config)
        elif conn.source_type == "google_drive":
            connector = GoogleDriveConnector(config)
        else:
            raise HTTPException(status_code=400, detail="Unknown source type")

        raw_data = connector.pull_data(source_ids, custom_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull data: {e}")

    if not raw_data:
        raise HTTPException(status_code=400, detail="No data returned from source")

    # Measure text size
    total_text_bytes = sum(len(d["text"].encode("utf-8")) for d in raw_data)

    if text_bytes + total_text_bytes > STORAGE_LIMIT_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"This sync would exceed the 50MB limit. "
            f"Data is {total_text_bytes // 1024}KB, "
            f"you have {(STORAGE_LIMIT_BYTES - text_bytes) // 1024}KB remaining.",
        )

    warn = (text_bytes + total_text_bytes) >= STORAGE_WARN_BYTES

    # Embed and store
    from app.core.vector_store.factory import get_vector_store

    openai_client = OpenAI(api_key=api_key)
    store = get_vector_store(current_user)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=current_user.chunk_size or 500,
        chunk_overlap=current_user.chunk_overlap or 50,
    )

    total_chunks = 0
    for item in raw_data:
        chunks = splitter.create_documents([item["text"]])
        texts = [c.page_content for c in chunks]
        metadatas = [
            {**item["metadata"], "page": item["metadata"].get("page", i + 1)}
            for i, _ in enumerate(chunks)
        ]
        ids = [str(uuid_mod.uuid4()) for _ in chunks]

        response = openai_client.embeddings.create(
            input=texts, model="text-embedding-3-small"
        )
        embeddings = [r.embedding for r in response.data]
        store.store(current_user.id, texts, embeddings, metadatas, ids)
        total_chunks += len(chunks)

    # Update storage + connection
    _update_storage(current_user.id, db, 0, total_text_bytes)
    conn.last_synced = datetime.now(timezone.utc)
    conn.doc_count = len(raw_data)
    conn.text_bytes = total_text_bytes
    conn.status = "synced"
    db.commit()

    return {
        "message": f"Synced {len(raw_data)} items, {total_chunks} chunks indexed.",
        "chunks": total_chunks,
        "warning": "You are approaching the 50MB storage limit." if warn else None,
    }


@router.delete("/{connection_id}")
def delete_connection(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    conn = (
        db.query(DataSourceConnection)
        .filter(
            DataSourceConnection.id == connection_id,
            DataSourceConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"message": "Connection removed"}


# Google Drive OAuth routes
@router.get("/gdrive/auth")
def gdrive_auth(current_user: User = Depends(get_verified_user)):
    url = get_gdrive_auth_url()
    return {"auth_url": url}


@router.get("/gdrive/callback")
def gdrive_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    """
    Google redirects here after OAuth consent.
    Store tokens temporarily — frontend polls to pick them up.
    """
    try:
        tokens = exchange_code_for_tokens(code)
        # Store in a temp cache (in production use Redis)
        # For now return tokens as query params back to frontend
        frontend_url = (
            f"{__import__('os').getenv('APP_BASE_URL', 'http://localhost:5173')}"
            f"/connectors?gdrive_token={tokens['access_token']}"
            f"&gdrive_refresh={tokens.get('refresh_token', '')}"
        )
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        return RedirectResponse(
            url=f"{__import__('os').getenv('APP_BASE_URL')}/connectors?gdrive_error={str(e)}"
        )


@router.get("/sql/preview/{connection_id}/{table_name}")
def preview_sql_table(
    connection_id: str,
    table_name: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    conn = (
        db.query(DataSourceConnection)
        .filter(
            DataSourceConnection.id == connection_id,
            DataSourceConnection.user_id == current_user.id,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if conn.source_type != "sql":
        raise HTTPException(
            status_code=400, detail="Preview only available for SQL connections"
        )

    # Clamp limit between 10 and 100
    limit = max(10, min(100, limit))

    config = json.loads(decrypt_api_key(conn.config_encrypted))
    connector = SQLConnector(config)

    try:
        from sqlalchemy import text, inspect

        with connector.engine.connect() as sql_conn:
            rows = (
                sql_conn.execute(
                    text(f'SELECT * FROM "{table_name}" LIMIT :limit'), {"limit": limit}
                )
                .mappings()
                .all()
            )

            if not rows:
                return {"columns": [], "rows": [], "total_shown": 0}

            columns = list(rows[0].keys())
            data = [
                {
                    col: (str(row[col]) if row[col] is not None else None)
                    for col in columns
                }
                for row in rows
            ]

            return {
                "columns": columns,
                "rows": data,
                "total_shown": len(data),
                "limit": limit,
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview failed: {str(e)}")
