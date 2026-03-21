import json
import uuid
import os
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserVectorConfig
from app.dependencies import get_verified_user
from app.core.security import encrypt_api_key, decrypt_api_key
from app.core.vector_store.factory import (
    get_vector_store,
    get_vector_store_from_config,
)

router = APIRouter(prefix="/vector-store", tags=["vector-store"])

REQUIRED_FIELDS = {
    "chroma": [],
    "pgvector": ["host", "port", "database", "user", "password"],
    "pinecone": ["api_key", "index_name"],
    "azure_search": ["endpoint", "admin_key", "index_name"],
}


@router.post("/test")
def test_connection(payload: dict, current_user: User = Depends(get_verified_user)):
    store_type = payload.get("store_type", "chroma")
    config = payload.get("config", {})
    required = REQUIRED_FIELDS.get(store_type, [])
    missing = [f for f in required if not config.get(f)]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")
    try:
        adapter = get_vector_store_from_config(store_type, config)
        success, message = adapter.test_connection()
        return {"success": success, "message": message}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/config")
def get_config(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    config = (
        db.query(UserVectorConfig)
        .filter(UserVectorConfig.user_id == current_user.id)
        .first()
    )
    if not config:
        return {
            "store_type": "chroma",
            "is_configured": False,
            "migration_status": "none",
            "migrated_count": 0,
            "total_count": 0,
        }
    return {
        "store_type": config.store_type,
        "is_configured": True,
        "is_active": config.is_active,
        "migration_status": config.migration_status or "none",
        "migrated_count": config.migrated_count or 0,
        "total_count": config.total_count or 0,
    }


@router.post("/configure")
def configure_vector_store(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    store_type = payload.get("store_type", "chroma")
    config = payload.get("config", {})
    required = REQUIRED_FIELDS.get(store_type, [])
    missing = [f for f in required if not config.get(f)]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    # Test connection before saving
    try:
        adapter = get_vector_store_from_config(store_type, config)
        success, message = adapter.test_connection()
        if not success:
            raise HTTPException(400, f"Connection test failed: {message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

    encrypted = encrypt_api_key(json.dumps(config)) if config else None

    existing = (
        db.query(UserVectorConfig)
        .filter(UserVectorConfig.user_id == current_user.id)
        .first()
    )

    if existing:
        existing.store_type = store_type
        existing.config_encrypted = encrypted
        existing.is_active = True
        existing.migration_status = "none"
        existing.migrated_count = 0
        existing.total_count = 0
    else:
        db.add(
            UserVectorConfig(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                store_type=store_type,
                config_encrypted=encrypted,
                is_active=True,
                migration_status="none",
            )
        )

    db.commit()
    return {"message": f"Vector store saved: {store_type}"}


@router.post("/migrate")
def start_migration(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Start migration from current active store → new target store.
    Runs in background thread — poll /migration-status for progress.
    """
    target_type = payload.get("target_store_type")
    target_config = payload.get("target_config", {})

    if not target_type:
        raise HTTPException(400, "target_store_type is required")

    required = REQUIRED_FIELDS.get(target_type, [])
    missing = [f for f in required if not target_config.get(f)]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    # Test destination first
    try:
        dest_adapter = get_vector_store_from_config(target_type, target_config)
        success, message = dest_adapter.test_connection()
        if not success:
            raise HTTPException(400, f"Destination connection failed: {message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

    # Get current source store
    source_adapter = get_vector_store(current_user)

    # Save new config as pending (not active yet)
    encrypted = encrypt_api_key(json.dumps(target_config)) if target_config else None

    existing = (
        db.query(UserVectorConfig)
        .filter(UserVectorConfig.user_id == current_user.id)
        .first()
    )

    if existing:
        existing.store_type = target_type
        existing.config_encrypted = encrypted
        existing.is_active = False  # not active until migration done
        existing.migration_status = "reading"
        existing.migration_source = existing.store_type
        existing.migration_started = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        )
        existing.migrated_count = 0
        existing.total_count = 0
        config_id = existing.id
    else:
        new_config = UserVectorConfig(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            store_type=target_type,
            config_encrypted=encrypted,
            is_active=False,
            migration_status="reading",
            migrated_count=0,
            total_count=0,
        )
        db.add(new_config)
        config_id = new_config.id

    db.commit()

    # Run migration in background
    db_url = os.getenv("DATABASE_URL")

    def run():
        from app.core.vector_store.migration import run_migration_background

        run_migration_background(
            user_id=current_user.id,
            source=source_adapter,
            destination=dest_adapter,
            db_url=db_url,
            config_id=config_id,
        )

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    return {
        "message": "Migration started in background.",
        "config_id": config_id,
    }


@router.get("/migration-status")
def migration_status(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    config = (
        db.query(UserVectorConfig)
        .filter(UserVectorConfig.user_id == current_user.id)
        .first()
    )

    if not config:
        return {"status": "none", "migrated": 0, "total": 0, "percent": 0}

    total = config.total_count or 0
    migrated = config.migrated_count or 0
    percent = round((migrated / total * 100) if total > 0 else 0)

    return {
        "status": config.migration_status or "none",
        "migrated": migrated,
        "total": total,
        "percent": percent,
        "store_type": config.store_type,
        "is_active": config.is_active,
    }


@router.delete("/config")
def reset_to_default(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    db.query(UserVectorConfig).filter(
        UserVectorConfig.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Reset to ChromaDB (default)"}
