import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, UserAPIKey
from app.dependencies import get_verified_user
from app.core.api_key_auth import generate_api_key

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.get("/")
def list_api_keys(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    keys = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.user_id == current_user.id)
        .order_by(UserAPIKey.created_at.desc())
        .all()
    )

    return [
        {
            "id": k.id,
            "name": k.name,
            "key_prefix": k.key_prefix,
            "requests_made": k.requests_made,
            "request_limit": k.request_limit,
            "last_used_at": str(k.last_used_at) if k.last_used_at else None,
            "created_at": str(k.created_at),
            "is_active": k.is_active,
        }
        for k in keys
    ]


@router.post("/")
def create_api_key(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    name = payload.get("name", "").strip()
    limit = payload.get("request_limit", 1000)

    if not name:
        raise HTTPException(status_code=400, detail="Key name is required")
    if len(name) > 64:
        raise HTTPException(status_code=400, detail="Name too long (max 64 chars)")

    # Max 10 keys per user
    count = db.query(UserAPIKey).filter(UserAPIKey.user_id == current_user.id).count()
    if count >= 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 API keys per account. Delete an existing key to create a new one.",
        )

    raw_key, key_hash, key_prefix = generate_api_key()

    key_row = UserAPIKey(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        request_limit=max(1, min(limit, 100000)),
        is_active=True,
    )
    db.add(key_row)
    db.commit()

    return {
        "id": key_row.id,
        "name": key_row.name,
        "key": raw_key,  # ← shown ONCE, never again
        "key_prefix": key_prefix,
        "request_limit": key_row.request_limit,
        "message": "Copy this key now — it will never be shown again.",
    }


@router.patch("/{key_id}")
def update_api_key(
    key_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    key_row = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.id == key_id, UserAPIKey.user_id == current_user.id)
        .first()
    )
    if not key_row:
        raise HTTPException(status_code=404, detail="API key not found")

    if "name" in payload:
        key_row.name = payload["name"]
    if "request_limit" in payload:
        key_row.request_limit = max(1, min(payload["request_limit"], 100000))
    if "is_active" in payload:
        key_row.is_active = payload["is_active"]

    db.commit()
    return {"message": "Updated"}


@router.post("/{key_id}/regenerate")
def regenerate_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    key_row = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.id == key_id, UserAPIKey.user_id == current_user.id)
        .first()
    )
    if not key_row:
        raise HTTPException(status_code=404, detail="API key not found")

    raw_key, key_hash, key_prefix = generate_api_key()
    key_row.key_hash = key_hash
    key_row.key_prefix = key_prefix
    key_row.requests_made = 0
    key_row.last_used_at = None
    db.commit()

    return {
        "key": raw_key,
        "message": "Key regenerated. Copy it now — it will never be shown again.",
    }


@router.delete("/{key_id}")
def delete_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    key_row = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.id == key_id, UserAPIKey.user_id == current_user.id)
        .first()
    )
    if not key_row:
        raise HTTPException(status_code=404, detail="API key not found")

    db.delete(key_row)
    db.commit()
    return {"message": "API key deleted"}
