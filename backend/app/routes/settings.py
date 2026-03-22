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


@router.patch("/")
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    from app.core.security import encrypt_api_key

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
    if payload.chat_provider:
        current_user.chat_provider = payload.chat_provider
    if payload.chat_model:
        current_user.chat_model = payload.chat_model
    if payload.embed_provider:
        current_user.embed_provider = payload.embed_provider
    if payload.embed_model:
        current_user.embed_model = payload.embed_model
    if payload.anthropic_api_key:
        current_user.anthropic_key_enc = encrypt_api_key(payload.anthropic_api_key)
    if payload.gemini_api_key:
        current_user.gemini_key_enc = encrypt_api_key(payload.gemini_api_key)
    if payload.ollama_base_url:
        current_user.ollama_base_url = payload.ollama_base_url

    db.commit()
    return {"message": "Settings updated successfully"}


@router.get("/")
def get_settings(current_user: User = Depends(get_verified_user)):
    return {
        "email": current_user.email,
        "preferred_model": current_user.preferred_model,
        "chat_provider": current_user.chat_provider or "openai",
        "chat_model": current_user.chat_model or "gpt-3.5-turbo",
        "embed_provider": current_user.embed_provider or "openai",
        "embed_model": current_user.embed_model or "text-embedding-3-small",
        "ollama_base_url": current_user.ollama_base_url or "http://localhost:11434",
        "has_api_key": current_user.openai_api_key_encrypted is not None,
        "has_anthropic_key": current_user.anthropic_key_enc is not None,
        "has_gemini_key": current_user.gemini_key_enc is not None,
        "chunk_size": current_user.chunk_size,
        "chunk_overlap": current_user.chunk_overlap,
    }


@router.delete("/clear-knowledge-base")
def clear_kb(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    from app.models import Document

    db.query(Document).filter(Document.user_id == current_user.id).delete()
    db.commit()
    delete_user_collection(current_user.id)
    return {"message": "Knowledge base cleared"}
