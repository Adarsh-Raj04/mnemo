from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import uuid
from dotenv import load_dotenv
import os

from app.database import get_db
from app.models import User, VerificationToken, PasswordResetToken
from app.schemas import SignupRequest, LoginRequest, TokenResponse, UserResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.email import send_verification_email, send_password_reset_email
from app.dependencies import get_current_user

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")


@router.post("/signup", status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Add this ↓
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400, detail="Password must be 72 characters or fewer"
        )

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = str(uuid.uuid4())
    vtoken = VerificationToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(vtoken)
    db.commit()

    email_sent = send_verification_email(user.email, token)

    if email_sent:
        return {
            "message": "Signup successful. Please check your email to verify your account."
        }
    else:
        # Clean rollback — delete token first, then user separately
        try:
            db.query(VerificationToken).filter(
                VerificationToken.user_id == user.id
            ).delete(synchronize_session=False)
            db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Cleanup error: {e}")

        raise HTTPException(
            status_code=500,
            detail="Verification email failed to send. Please try signing up again.",
        )


@router.get("/verify-email", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    vtoken = (
        db.query(VerificationToken).filter(VerificationToken.token == token).first()
    )

    if not vtoken:
        return HTMLResponse(
            "<h2>Invalid or already used verification link.</h2>", status_code=400
        )

    if vtoken.expires_at < datetime.now(timezone.utc):
        db.delete(vtoken)
        db.commit()
        return HTMLResponse(
            "<h2>Verification link has expired. Please sign up again.</h2>",
            status_code=400,
        )

    user = db.query(User).filter(User.id == vtoken.user_id).first()
    user.is_verified = True
    db.delete(vtoken)
    db.commit()

    return HTMLResponse(
        """
        <div style='font-family:Arial;text-align:center;padding:60px;'>
            <h2 style='color:#3C3489;'>Email verified successfully!</h2>
            <p>You can now log in to your Mnemo.</p>
            <a href='{APP_BASE_URL}' style='color:#534AB7;'>Go to App</a>
        </div>
    """
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_verified:
        # Delete any existing token first
        db.query(VerificationToken).filter(
            VerificationToken.user_id == user.id
        ).delete()
        db.commit()

        # Create a fresh token
        token = str(uuid.uuid4())
        vtoken = VerificationToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db.add(vtoken)
        db.commit()

        # Resend email
        send_verification_email(user.email, token)

        raise HTTPException(
            status_code=403,
            detail="Email not verified. We've sent a new verification link to your email.",
        )

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload["old_password"], current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    current_user.password_hash = hash_password(payload["new_password"])
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
def forgot_password(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email", "").strip().lower()
    user = db.query(User).filter(User.email == email).first()

    # Always return success to prevent email enumeration
    if not user or not user.is_verified:
        return {"message": "If that email exists, a reset link has been sent."}

    # Delete any existing reset tokens for this user
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete(
        synchronize_session=False
    )
    db.commit()

    token = str(uuid.uuid4())
    reset_token = PasswordResetToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    import threading

    threading.Thread(
        target=send_password_reset_email, args=(user.email, token), daemon=True
    ).start()

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: dict, db: Session = Depends(get_db)):
    token = payload.get("token", "")
    password = payload.get("password", "")

    if len(password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long")

    reset_token = (
        db.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=400, detail="Invalid or already used reset link"
        )

    if reset_token.expires_at < datetime.now(timezone.utc):
        db.query(PasswordResetToken).filter(PasswordResetToken.token == token).delete(
            synchronize_session=False
        )
        db.commit()
        raise HTTPException(
            status_code=400, detail="Reset link has expired. Please request a new one."
        )

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    user.password_hash = hash_password(password)

    db.query(PasswordResetToken).filter(PasswordResetToken.token == token).delete(
        synchronize_session=False
    )
    db.commit()

    return {"message": "Password reset successfully. You can now log in."}
