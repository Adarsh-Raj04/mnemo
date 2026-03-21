from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import SettingsUpdate
from app.dependencies import get_verified_user
from app.core.security import (
    encrypt_api_key,
    decrypt_api_key,
    hash_password,
    verify_password,
)
from app.core.embeddings import delete_user_collection
from fastapi import HTTPException

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/")
def get_settings(current_user: User = Depends(get_verified_user)):
    return {
        "email": current_user.email,
        "preferred_model": current_user.preferred_model,
        "chunk_size": current_user.chunk_size,
        "chunk_overlap": current_user.chunk_overlap,
        "has_api_key": current_user.openai_api_key_encrypted is not None,
    }


@router.patch("/")
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    if payload.preferred_model:
        current_user.preferred_model = payload.preferred_model
    if payload.chunk_size:
        current_user.chunk_size = payload.chunk_size
    if payload.chunk_overlap is not None:
        current_user.chunk_overlap = payload.chunk_overlap
    if payload.openai_api_key:
        current_user.openai_api_key_encrypted = encrypt_api_key(payload.openai_api_key)
    if payload.new_password:
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    return {"message": "Settings updated successfully"}


@router.delete("/clear-knowledge-base")
def clear_kb(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    from app.models import Document

    db.query(Document).filter(Document.user_id == current_user.id).delete()
    db.commit()
    delete_user_collection(current_user.id)
    return {"message": "Knowledge base cleared"}
