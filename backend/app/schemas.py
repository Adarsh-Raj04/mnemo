from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class SignupRequest(BaseModel):
    name: str  # ← add this
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str  # ← add this
    email: str
    is_verified: bool
    preferred_model: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_size: Optional[int]
    total_pages: Optional[int]
    chunk_count: Optional[int]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    session_id: Optional[str] = None  # ← now optional
    question: str
    owner_id: Optional[str] = None


class ShareRequest(BaseModel):
    email: EmailStr
    permission: str = "viewer"


class ShareResponse(BaseModel):
    id: str
    owner_user_id: str
    shared_with_user_id: str
    permission: str
    created_at: datetime

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    preferred_model: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    openai_api_key: Optional[str] = None
    new_password: Optional[str] = None
