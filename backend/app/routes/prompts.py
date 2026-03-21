import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, SystemPrompt, SystemPromptScopeEnum
from app.dependencies import get_verified_user
from app.core.llm import DEFAULT_SYSTEM_PROMPT

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("/global")
def get_global_prompt(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    prompt = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == current_user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.global_,
        )
        .first()
    )

    return {
        "prompt_text": prompt.prompt_text if prompt else DEFAULT_SYSTEM_PROMPT,
        "is_customized": prompt is not None,
        "default": DEFAULT_SYSTEM_PROMPT,
    }


@router.put("/global")
def set_global_prompt(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    text = payload.get("prompt_text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty")
    if len(text) > 4000:
        raise HTTPException(
            status_code=400, detail="Prompt too long (max 4000 characters)"
        )

    existing = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == current_user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.global_,
        )
        .first()
    )

    if existing:
        existing.prompt_text = text
    else:
        db.add(
            SystemPrompt(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                scope=SystemPromptScopeEnum.global_,
                prompt_text=text,
            )
        )

    db.commit()
    return {"message": "Global prompt saved"}


@router.delete("/global")
def reset_global_prompt(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    db.query(SystemPrompt).filter(
        SystemPrompt.user_id == current_user.id,
        SystemPrompt.scope == SystemPromptScopeEnum.global_,
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Reset to default prompt"}


@router.get("/source/{source_id}")
def get_source_prompt(
    source_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    prompt = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == current_user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.source,
            SystemPrompt.source_id == source_id,
        )
        .first()
    )

    return {
        "prompt_text": prompt.prompt_text if prompt else None,
        "is_customized": prompt is not None,
    }


@router.put("/source/{source_id}")
def set_source_prompt(
    source_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    text = payload.get("prompt_text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty")

    existing = (
        db.query(SystemPrompt)
        .filter(
            SystemPrompt.user_id == current_user.id,
            SystemPrompt.scope == SystemPromptScopeEnum.source,
            SystemPrompt.source_id == source_id,
        )
        .first()
    )

    if existing:
        existing.prompt_text = text
    else:
        db.add(
            SystemPrompt(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                scope=SystemPromptScopeEnum.source,
                source_id=source_id,
                prompt_text=text,
            )
        )

    db.commit()
    return {"message": "Source-level prompt saved"}


@router.delete("/source/{source_id}")
def delete_source_prompt(
    source_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    db.query(SystemPrompt).filter(
        SystemPrompt.user_id == current_user.id,
        SystemPrompt.scope == SystemPromptScopeEnum.source,
        SystemPrompt.source_id == source_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Source prompt removed — will use global/default"}
