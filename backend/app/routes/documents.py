from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import tempfile, os, uuid

from app.database import get_db
from app.models import User, Document
from app.schemas import DocumentResponse
from app.dependencies import get_verified_user
from app.core.rag import load_and_chunk, embed_and_store
from app.core.embeddings import delete_user_document
from app.core.security import decrypt_api_key
from app.core.embeddings import get_user_collection

router = APIRouter(prefix="/documents", tags=["documents"])


def get_api_key(user: User) -> str:
    if not user.openai_api_key_encrypted:
        raise HTTPException(
            status_code=400, detail="Please add your OpenAI API key in Settings first"
        )
    return decrypt_api_key(user.openai_api_key_encrypted)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    api_key = get_api_key(current_user)
    allowed = [".pdf", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400, detail="Only PDF and TXT files are supported"
        )

    existing = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.filename == file.filename)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="A document with this name already exists"
        )

    content = await file.read()
    file_size = len(content)

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        chunks, total_pages = load_and_chunk(
            tmp_path, file.filename, current_user.chunk_size, current_user.chunk_overlap
        )
        chunk_count = embed_and_store(
            chunks, file.filename, total_pages, current_user, api_key
        )
    finally:
        os.unlink(tmp_path)

    doc = Document(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        filename=file.filename,
        file_size=file_size,
        total_pages=total_pages,
        chunk_count=chunk_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {"message": f"Uploaded successfully", "chunk_count": chunk_count}


@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db), current_user: User = Depends(get_verified_user)
):
    return db.query(Document).filter(Document.user_id == current_user.id).all()


@router.delete("/{filename}")
def delete_document(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.filename == filename)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_user_document(current_user.id, filename)
    db.delete(doc)
    db.commit()
    return {"message": f"{filename} deleted successfully"}


@router.get("/chunks/{filename}")
def get_document_chunks(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.filename == filename)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    collection = get_user_collection(current_user.id)
    results = collection.get(include=["documents", "metadatas"])

    chunks = []
    for i, meta in enumerate(results["metadatas"]):
        if meta.get("filename") == filename:
            chunks.append(
                {
                    "index": len(chunks),
                    "text": results["documents"][i],
                    "page": meta.get("page", "?"),
                }
            )

    chunks.sort(key=lambda c: (c["page"], c["index"]))
    return {"filename": filename, "chunks": chunks}
