from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Enum,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)
    openai_api_key_encrypted = Column(String, nullable=True)
    preferred_model = Column(String, default="gpt-3.5-turbo")
    chunk_size = Column(Integer, default=500)
    chunk_overlap = Column(Integer, default=50)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # --- New provider config fields ---
    chat_provider = Column(String, default="openai")
    chat_model = Column(String, default="gpt-3.5-turbo")

    embed_provider = Column(String, default="openai")
    embed_model = Column(String, default="text-embedding-3-small")

    anthropic_key_enc = Column(Text, nullable=True)
    gemini_key_enc = Column(Text, nullable=True)

    ollama_base_url = Column(String, default="http://localhost:11434")

    documents = relationship("Document", back_populates="owner", cascade="all, delete")
    chat_sessions = relationship(
        "ChatSession", back_populates="owner", cascade="all, delete"
    )
    shares_given = relationship(
        "KBShare", foreign_keys="KBShare.owner_user_id", back_populates="owner"
    )
    shares_received = relationship(
        "KBShare",
        foreign_keys="KBShare.shared_with_user_id",
        back_populates="shared_with",
    )


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    total_pages = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="documents")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(
        String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


class PermissionEnum(str, enum.Enum):
    viewer = "viewer"
    contributor = "contributor"


class KBShare(Base):
    __tablename__ = "kb_shares"

    id = Column(String, primary_key=True, default=gen_uuid)
    owner_user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    shared_with_user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    permission = Column(Enum(PermissionEnum), default=PermissionEnum.viewer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship(
        "User", foreign_keys=[owner_user_id], back_populates="shares_given"
    )
    shared_with = relationship(
        "User", foreign_keys=[shared_with_user_id], back_populates="shares_received"
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VectorStoreTypeEnum(str, enum.Enum):
    chroma = "chroma"
    pgvector = "pgvector"
    pinecone = "pinecone"
    azure_search = "azure_search"


class UserVectorConfig(Base):
    __tablename__ = "user_vector_config"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    store_type = Column(Enum(VectorStoreTypeEnum), default=VectorStoreTypeEnum.chroma)
    config_encrypted = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    migration_status = Column(String, default="none")
    migration_source = Column(String, nullable=True)
    migration_started = Column(DateTime(timezone=True), nullable=True)
    migration_done_at = Column(DateTime(timezone=True), nullable=True)
    migrated_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    is_primary = Column(Boolean, default=True)

    # ← uselist=False ensures it's always a single object not a list
    owner = relationship("User", backref=backref("vector_config", uselist=False))


class SourceTypeEnum(str, enum.Enum):
    file = "file"
    google_drive = "google_drive"
    sql = "sql"


class DataSourceConnection(Base):
    __tablename__ = "data_source_connections"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(Enum(SourceTypeEnum), nullable=False)
    name = Column(String, nullable=False)
    config_encrypted = Column(Text, nullable=True)
    status = Column(String, default="connected")
    last_synced = Column(DateTime(timezone=True), nullable=True)
    doc_count = Column(Integer, default=0)
    original_bytes = Column(Integer, default=0)
    text_bytes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", backref="data_sources")


class SystemPromptScopeEnum(str, enum.Enum):
    global_ = "global"
    source = "source"


class SystemPrompt(Base):
    __tablename__ = "system_prompts"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope = Column(Enum(SystemPromptScopeEnum), default=SystemPromptScopeEnum.global_)
    source_id = Column(
        String,
        ForeignKey("data_source_connections.id", ondelete="CASCADE"),
        nullable=True,
    )
    prompt_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", backref="system_prompts")
    source = relationship("DataSourceConnection", backref="prompt")


class StorageUsage(Base):
    __tablename__ = "storage_usage"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    original_bytes = Column(Integer, default=0)
    text_bytes = Column(Integer, default=0)
    last_calculated = Column(DateTime(timezone=True), server_default=func.now())
    warning_sent = Column(Boolean, default=False)

    owner = relationship("User", backref="storage_usage")
