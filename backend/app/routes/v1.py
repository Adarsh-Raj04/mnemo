from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Security
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
import json, uuid, tempfile, os

from app.database import get_db
from app.models import User, ChatSession, ChatMessage, Document
from app.core.api_key_auth import get_user_from_api_key
from app.core.rag import load_and_chunk, embed_and_store, search_multiple_kbs
from app.core.llm import resolve_system_prompt, stream_answer, DEFAULT_SYSTEM_PROMPT
from app.core.providers.factory import get_llm_provider, get_provider_display_name
from app.core.security import decrypt_api_key

router = APIRouter(prefix="/v1", tags=["Public API"])
KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=True)


def get_api_user(
    x_api_key: str = Security(KEY_HEADER), db: Session = Depends(get_db)
) -> User:
    return get_user_from_api_key(x_api_key, db)


# ── GET /v1/health ───────────────────────────────────────────
@router.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── GET /v1/documents ────────────────────────────────────────
@router.get("/documents")
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_api_user)):
    docs = db.query(Document).filter(Document.user_id == user.id).all()
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "chunk_count": d.chunk_count,
                "total_pages": d.total_pages,
                "file_size": d.file_size,
                "uploaded_at": str(d.uploaded_at),
            }
            for d in docs
        ],
        "total": len(docs),
    }


# ── POST /v1/upload ──────────────────────────────────────────
@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_api_user),
):
    allowed = [".pdf", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF and TXT supported")

    if not user.openai_api_key_encrypted:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    content = await file.read()
    file_size = len(content)

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        chunks, total_pages = load_and_chunk(
            tmp_path, file.filename, user.chunk_size or 500, user.chunk_overlap or 50
        )
        chunk_count = embed_and_store(chunks, file.filename, total_pages, user)
    finally:
        os.unlink(tmp_path)

    doc = Document(
        id=str(uuid.uuid4()),
        user_id=user.id,
        filename=file.filename,
        file_size=file_size,
        total_pages=total_pages,
        chunk_count=chunk_count,
    )
    db.add(doc)
    db.commit()

    return {
        "filename": file.filename,
        "chunk_count": chunk_count,
        "total_pages": total_pages,
        "message": "Document indexed successfully",
    }


# ── POST /v1/chat ────────────────────────────────────────────
@router.post("/chat")
def chat(
    payload: dict, db: Session = Depends(get_db), user: User = Depends(get_api_user)
):
    """
    Simple non-streaming chat endpoint.
    Body: { "question": "...", "session_id": "..." (optional) }
    """
    question = payload.get("question", "").strip()
    session_id = payload.get("session_id")

    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    # Session handling
    if session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        is_first = False
    else:
        session = ChatSession(
            id=str(uuid.uuid4()), user_id=user.id, title=question[:50]
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        is_first = True

    # Search
    chunks, metadatas = search_multiple_kbs(question, [user])

    if not chunks:
        answer = "I couldn't find relevant content in your documents."
        sources = []
    else:
        # Build answer non-streaming
        try:
            llm_provider = get_llm_provider(user)
            model = user.chat_model or "gpt-3.5-turbo"
            system_prompt = resolve_system_prompt(user, db)

            from app.core.llm import build_user_message

            context = "\n\n---\n\n".join(chunks)
            user_msg = f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"

            tokens = list(llm_provider.stream(system_prompt, user_msg, model))
            answer = "".join(tokens)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

        seen, sources = set(), []
        for meta in metadatas:
            key = (meta.get("filename"), meta.get("page"))
            if key not in seen:
                seen.add(key)
                sources.append(
                    {"filename": meta.get("filename"), "page": meta.get("page")}
                )

    # Save messages
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()), session_id=session.id, role="user", content=question
        )
    )
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=json.dumps(sources),
        )
    )
    db.commit()

    return {
        "answer": answer,
        "sources": sources,
        "session_id": session.id,
    }


# ── POST /v1/chat/stream ─────────────────────────────────────
@router.post("/chat/stream")
def chat_stream(
    payload: dict, db: Session = Depends(get_db), user: User = Depends(get_api_user)
):
    """
    Streaming version — returns SSE just like the web app.
    Body: { "question": "...", "session_id": "..." (optional) }
    """
    question = payload.get("question", "").strip()
    session_id = payload.get("session_id")

    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    def event_generator():
        import json as _json

        def sse(data: dict) -> str:
            return f"data: {_json.dumps(data)}\n\n"

        # Session
        if session_id:
            session = (
                db.query(ChatSession)
                .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
                .first()
            )
            if not session:
                yield sse({"type": "error", "message": "Session not found"})
                return
        else:
            session = ChatSession(
                id=str(uuid.uuid4()), user_id=user.id, title=question[:50]
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        yield sse({"type": "session", "session_id": session.id})
        yield sse({"type": "status", "message": "🔍 Searching your documents..."})

        chunks, metadatas = search_multiple_kbs(question, [user])

        if not chunks:
            yield sse(
                {
                    "type": "token",
                    "content": "I couldn't find relevant content in your documents.",
                }
            )
            yield sse({"type": "sources", "content": []})
            yield sse({"type": "done", "session_id": session.id})
            return

        yield sse({"type": "status", "message": "🤖 Generating answer..."})

        try:
            llm_provider = get_llm_provider(user)
            model = user.chat_model or "gpt-3.5-turbo"
            system_prompt = resolve_system_prompt(user, db)
            full_answer = []

            for event in stream_answer(
                question, chunks, metadatas, llm_provider, model, system_prompt
            ):
                if event["type"] == "token":
                    full_answer.append(event["content"])
                yield sse(event)

            answer = "".join(full_answer)
        except Exception as e:
            yield sse({"type": "error", "message": str(e)})
            return

        db.add(
            ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session.id,
                role="user",
                content=question,
            )
        )
        db.add(
            ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session.id,
                role="assistant",
                content=answer,
            )
        )
        db.commit()

        yield sse({"type": "done", "session_id": session.id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /v1/sessions ─────────────────────────────────────────
@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_api_user)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
        .all()
    )

    return {
        "sessions": [
            {"id": s.id, "title": s.title, "created_at": str(s.created_at)}
            for s in sessions
        ]
    }


# ── GET /v1/sessions/{id}/messages ───────────────────────────
@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str, db: Session = Depends(get_db), user: User = Depends(get_api_user)
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.id,
        "title": session.title,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "sources": json.loads(m.sources) if m.sources else [],
                "created_at": str(m.created_at),
            }
            for m in session.messages
        ],
    }
