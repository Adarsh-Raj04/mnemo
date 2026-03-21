from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.models import User, KBShare
from app.schemas import ShareRequest, ShareResponse
from app.dependencies import get_verified_user
from app.core.email import send_share_invite_email

router = APIRouter(prefix="/sharing", tags=["sharing"])


@router.post("/invite")
def invite_user(
    payload: ShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    if payload.email == current_user.email:
        raise HTTPException(status_code=400, detail="You cannot share with yourself")

    target = db.query(User).filter(User.email == payload.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="No user found with that email")
    if not target.is_verified:
        raise HTTPException(
            status_code=400, detail="That user has not verified their email yet"
        )

    existing = (
        db.query(KBShare)
        .filter(
            KBShare.owner_user_id == current_user.id,
            KBShare.shared_with_user_id == target.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    if payload.permission not in ["viewer", "contributor"]:
        raise HTTPException(
            status_code=400, detail="Permission must be viewer or contributor"
        )

    share = KBShare(
        id=str(uuid.uuid4()),
        owner_user_id=current_user.id,
        shared_with_user_id=target.id,
        permission=payload.permission,
    )
    db.add(share)
    db.commit()

    send_share_invite_email(target.email, current_user.email, payload.permission)

    return {"message": f"Shared with {payload.email} as {payload.permission}"}


@router.get("/my-shares", response_model=list[ShareResponse])
def my_shares(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    return db.query(KBShare).filter(KBShare.owner_user_id == current_user.id).all()


@router.get("/shared-with-me")
def shared_with_me(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    shares = (
        db.query(KBShare).filter(KBShare.shared_with_user_id == current_user.id).all()
    )
    result = []
    for share in shares:
        owner = db.query(User).filter(User.id == share.owner_user_id).first()
        result.append(
            {
                "share_id": share.id,
                "owner_email": owner.email,
                "owner_id": owner.id,
                "permission": share.permission,
                "created_at": share.created_at,
            }
        )
    return result


@router.delete("/{share_id}")
def revoke_share(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    share = (
        db.query(KBShare)
        .filter(KBShare.id == share_id, KBShare.owner_user_id == current_user.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    db.delete(share)
    db.commit()
    return {"message": "Access revoked successfully"}


@router.patch("/{share_id}/permission")
def update_permission(
    share_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    share = (
        db.query(KBShare)
        .filter(KBShare.id == share_id, KBShare.owner_user_id == current_user.id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if payload.get("permission") not in ["viewer", "contributor"]:
        raise HTTPException(status_code=400, detail="Invalid permission")
    share.permission = payload["permission"]
    db.commit()
    return {"message": "Permission updated"}


@router.get("/my-shares-detailed")
def my_shares_detailed(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    shares = db.query(KBShare).filter(KBShare.owner_user_id == current_user.id).all()
    result = []
    for share in shares:
        target = db.query(User).filter(User.id == share.shared_with_user_id).first()
        result.append(
            {
                "id": share.id,
                "shared_with_email": target.email,
                "shared_with_user_id": share.shared_with_user_id,
                "permission": share.permission,
                "created_at": str(share.created_at),
            }
        )
    return result
