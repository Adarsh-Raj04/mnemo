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
    # Recalculate from documents table
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    doc_bytes = sum(d.file_size or 0 for d in docs)

    # From connectors
    sources = (
        db.query(DataSourceConnection)
        .filter(DataSourceConnection.user_id == current_user.id)
        .all()
    )
    source_bytes = sum(s.original_bytes or 0 for s in sources)

    total_original = doc_bytes + source_bytes

    usage = (
        db.query(StorageUsage).filter(StorageUsage.user_id == current_user.id).first()
    )
    total_text = usage.text_bytes if usage else 0

    percent_original = round((total_original / STORAGE_LIMIT_BYTES) * 100, 1)
    percent_text = round((total_text / STORAGE_LIMIT_BYTES) * 100, 1)

    status = "ok"
    if total_original >= STORAGE_LIMIT_BYTES or total_text >= STORAGE_LIMIT_BYTES:
        status = "full"
    elif total_original >= STORAGE_WARN_BYTES or total_text >= STORAGE_WARN_BYTES:
        status = "warning"

    return {
        "original_bytes": total_original,
        "text_bytes": total_text,
        "limit_bytes": STORAGE_LIMIT_BYTES,
        "warn_bytes": STORAGE_WARN_BYTES,
        "percent_original": percent_original,
        "percent_text": percent_text,
        "status": status,
        "doc_count": len(docs),
        "source_count": len(sources),
    }
