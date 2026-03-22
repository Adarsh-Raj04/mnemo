from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, StorageUsage, Document, DataSourceConnection
from app.dependencies import get_verified_user

router = APIRouter(prefix="/storage", tags=["storage"])

STORAGE_LIMIT_BYTES = 50 * 1024 * 1024
STORAGE_WARN_BYTES = 40 * 1024 * 1024


@router.get("/usage")
def get_storage_usage(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    # Check if user has own vector store
    config_list = getattr(current_user, "vector_config", None)
    config = (
        (config_list[0] if isinstance(config_list, list) else config_list)
        if config_list
        else None
    )
    has_own_store = config and config.is_active and config.store_type != "chroma"

    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    doc_bytes = sum(d.file_size or 0 for d in docs)
    sources = (
        db.query(DataSourceConnection)
        .filter(DataSourceConnection.user_id == current_user.id)
        .all()
    )
    source_bytes = sum(s.original_bytes or 0 for s in sources)
    total = doc_bytes + source_bytes

    usage = (
        db.query(StorageUsage).filter(StorageUsage.user_id == current_user.id).first()
    )
    text_bytes = usage.text_bytes if usage else 0

    if has_own_store:
        # No limit — return unlimited state
        return {
            "original_bytes": total,
            "text_bytes": text_bytes,
            "limit_bytes": None,
            "warn_bytes": None,
            "percent_original": 0,
            "percent_text": 0,
            "status": "unlimited",
            "doc_count": len(docs),
            "source_count": len(sources),
            "has_own_store": True,
            "store_type": config.store_type,
        }

    percent = round((total / (50 * 1024 * 1024)) * 100, 1)
    status = (
        "full"
        if total >= 50 * 1024 * 1024
        else "warning" if total >= 40 * 1024 * 1024 else "ok"
    )

    return {
        "original_bytes": total,
        "text_bytes": text_bytes,
        "limit_bytes": 50 * 1024 * 1024,
        "warn_bytes": 40 * 1024 * 1024,
        "percent_original": percent,
        "percent_text": round((text_bytes / (50 * 1024 * 1024)) * 100, 1),
        "status": status,
        "doc_count": len(docs),
        "source_count": len(sources),
        "has_own_store": False,
        "store_type": "chroma",
    }
