from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import uuid, json

from app.database import get_db
from app.models import User, ChatSession, ChatMessage, KBShare
from app.schemas import ChatRequest, ChatSessionResponse, ChatMessageResponse
from app.dependencies import get_verified_user
from app.core.rag import search_multiple_kbs
from app.core.llm import resolve_system_prompt, stream_answer, generate_session_title
from app.core.security import decrypt_api_key
from app.core.providers.factory import get_llm_provider, get_provider_display_name

router = APIRouter(prefix="/chat", tags=["chat"])


def get_api_key(user: User) -> str:
    if not user.openai_api_key_encrypted:
        raise HTTPException(
            status_code=400, detail="Please add your OpenAI API key in Settings first"
        )
    return decrypt_api_key(user.openai_api_key_encrypted)


def get_search_users(current_user, owner_id, db):
    if owner_id and owner_id != current_user.id:
        share = (
            db.query(KBShare)
            .filter(
                KBShare.owner_user_id == owner_id,
                KBShare.shared_with_user_id == current_user.id,
            )
            .first()
        )
        if not share:
            raise HTTPException(status_code=403, detail="Access denied")
        owner = db.query(User).filter(User.id == owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")
        return [owner]

    shared_owner_ids = [
        s.owner_user_id
        for s in db.query(KBShare)
        .filter(KBShare.shared_with_user_id == current_user.id)
        .all()
    ]
    shared_users = (
        db.query(User).filter(User.id.in_(shared_owner_ids)).all()
        if shared_owner_ids
        else []
    )

    return [current_user] + shared_users


def sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


@router.post("/stream")
def stream_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Streaming SSE endpoint.
    Emits: status → status → status → token* → sources → done
    """

    def event_generator():
        # ── Session ─────────────────────────────────────────────
        if not payload.session_id:
            session = ChatSession(
                id=str(uuid.uuid4()), user_id=current_user.id, title="..."
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            is_first_message = True
        else:
            session = (
                db.query(ChatSession)
                .filter(
                    ChatSession.id == payload.session_id,
                    ChatSession.user_id == current_user.id,
                )
                .first()
            )
            if not session:
                yield sse_event({"type": "error", "message": "Session not found"})
                return
            is_first_message = (
                not db.query(ChatMessage)
                .filter(ChatMessage.session_id == session.id)
                .first()
            )

        # Emit session_id immediately so frontend can update URL
        yield sse_event({"type": "session", "session_id": session.id})

        # ── Step 1: Searching ────────────────────────────────────
        yield sse_event({"type": "status", "message": "🔍 Searching your documents..."})

        try:
            search_users = get_search_users(current_user, payload.owner_id, db)
            chunks, metadatas = search_multiple_kbs(payload.question, search_users)
        except HTTPException as e:
            yield sse_event({"type": "error", "message": e.detail})
            return
        except Exception as e:
            yield sse_event({"type": "error", "message": f"Search failed: {str(e)}"})
            return

        # ── Step 2: Ranking ──────────────────────────────────────
        yield sse_event({"type": "status", "message": "📊 Ranking relevant chunks..."})

        if not chunks:
            yield sse_event(
                {"type": "status", "message": "⚠️ No relevant content found"}
            )
            no_answer = "I couldn't find relevant content in your documents."
            yield sse_event({"type": "token", "content": no_answer})
            yield sse_event({"type": "sources", "content": []})
            yield sse_event(
                {
                    "type": "done",
                    "answer": no_answer,
                    "sources": "[]",
                    "session_id": session.id,
                    "session_title": session.title,
                }
            )
            db.add(
                ChatMessage(
                    id=str(uuid.uuid4()),
                    session_id=session.id,
                    role="user",
                    content=payload.question,
                )
            )
            db.add(
                ChatMessage(
                    id=str(uuid.uuid4()),
                    session_id=session.id,
                    role="assistant",
                    content=no_answer,
                    sources="[]",
                )
            )
            db.commit()
            return

        # ── Step 3: Get LLM provider ─────────────────────────────
        try:
            llm_provider = get_llm_provider(current_user)
        except ValueError as e:
            yield sse_event({"type": "error", "message": str(e)})
            return

        model = current_user.chat_model or "gpt-3.5-turbo"
        display_name = get_provider_display_name(
            current_user.chat_provider or "openai", model
        )

        yield sse_event(
            {
                "type": "status",
                "message": f"🤖 Generating answer with {display_name}...",
            }
        )

        # ── Step 4: Stream tokens ────────────────────────────────
        system_prompt = resolve_system_prompt(current_user, db)
        full_answer = []
        sources_json = "[]"

        try:
            for event in stream_answer(
                query=payload.question,
                context_chunks=chunks,
                metadatas=metadatas,
                llm_provider=llm_provider,
                model=model,
                system_prompt=system_prompt,
            ):
                if event["type"] == "token":
                    full_answer.append(event["content"])
                    yield sse_event(event)
                elif event["type"] == "sources":
                    yield sse_event(event)
                elif event["type"] == "done":
                    sources_json = event["sources"]
        except Exception as e:
            yield sse_event(
                {"type": "error", "message": f"Generation failed: {str(e)}"}
            )
            return

        answer = "".join(full_answer)

        # ── Session title ────────────────────────────────────────
        if is_first_message:
            try:
                session.title = generate_session_title(
                    payload.question, llm_provider, model
                )
            except Exception:
                session.title = payload.question[:50]

        # ── Save to DB ───────────────────────────────────────────
        db.add(
            ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session.id,
                role="user",
                content=payload.question,
            )
        )
        db.add(
            ChatMessage(
                id=str(uuid.uuid4()),
                session_id=session.id,
                role="assistant",
                content=answer,
                sources=sources_json,
            )
        )
        db.commit()

        yield sse_event(
            {
                "type": "done",
                "session_id": session.id,
                "session_title": session.title,
            }
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# Keep existing non-streaming endpoints below...
@router.post("/sessions", response_model=ChatSessionResponse)
def create_session(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    session = ChatSession(
        id=str(uuid.uuid4()), user_id=current_user.id, title="New Chat"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[ChatSessionResponse])
def list_sessions(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
def get_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.messages


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


@router.post("/ask")
def ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    api_key = get_api_key(current_user)

    # ── Session handling ────────────────────────────────────────
    if not payload.session_id:
        # New session — AI will name it after first message
        session = ChatSession(
            id=str(uuid.uuid4()), user_id=current_user.id, title="..."
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        is_first_message = True
    else:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.id == payload.session_id,
                ChatSession.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        # Check if this is actually the first message
        is_first_message = (
            not db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .first()
        )

    # ── KB search ───────────────────────────────────────────────
    # Raises 403/404 automatically if access denied
    search_users = get_search_users(current_user, payload.owner_id, db)
    system_prompt = resolve_system_prompt(current_user, db)
    chunks, metadatas = search_multiple_kbs(payload.question, search_users, api_key)

    # ── Generate answer ─────────────────────────────────────────
    if not chunks:
        answer = "I couldn't find relevant content in your documents."
        sources_json = "[]"
    else:
        answer, sources_json = get_answer(
            payload.question,
            chunks,
            metadatas,
            api_key,
            current_user.preferred_model,
            system_prompt=system_prompt,
        )

    # ── AI session title on first message ───────────────────────
    if is_first_message:
        try:
            session.title = generate_session_title(
                payload.question, api_key, current_user.preferred_model
            )
        except Exception:
            # Non-fatal — fall back to truncated question
            session.title = payload.question[:50]

    # ── Save messages ────────────────────────────────────────────
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="user",
            content=payload.question,
        )
    )
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=sources_json,
        )
    )
    db.commit()

    return {
        "answer": answer,
        "sources": json.loads(sources_json),
        "session_id": session.id,
        "session_title": session.title,
    }
