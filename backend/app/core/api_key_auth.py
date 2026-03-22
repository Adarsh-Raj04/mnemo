import hashlib
import secrets
from datetime import datetime, timezone
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from app.models import UserAPIKey, User

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def generate_api_key() -> tuple[str, str, str]:
    """
    Returns (raw_key, key_hash, key_prefix)
    raw_key is shown ONCE to the user and never stored.
    Only key_hash is stored in DB.
    """
    raw_key = f"mnemo_sk_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:16] + "..."
    return raw_key, key_hash, key_prefix


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def get_user_from_api_key(api_key: str, db: Session) -> User:
    """
    Validate an API key and return the associated user.
    Updates usage stats on every call.
    """
    if not api_key or not api_key.startswith("mnemo_sk_"):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format. Key must start with 'mnemo_sk_'.",
        )

    key_hash = hash_key(api_key)
    key_row = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.key_hash == key_hash, UserAPIKey.is_active == True)
        .first()
    )

    if not key_row:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")

    # Check rate limit
    if key_row.request_limit and key_row.requests_made >= key_row.request_limit:
        raise HTTPException(
            status_code=429,
            detail=f"API key rate limit reached ({key_row.request_limit} requests). "
            f"Regenerate your key or increase the limit in Settings.",
        )

    # Update usage
    key_row.requests_made += 1
    key_row.last_used_at = datetime.now(timezone.utc)
    db.commit()

    user = db.query(User).filter(User.id == key_row.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified.")

    return user


def get_api_key_user(
    x_api_key: str = Security(API_KEY_HEADER),
    db: Session = None,
) -> User:
    """FastAPI dependency for API key auth."""
    return get_user_from_api_key(x_api_key, db)
