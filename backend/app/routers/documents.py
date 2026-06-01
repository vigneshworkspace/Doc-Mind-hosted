import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, Document
from app.schemas.schemas import DocumentOut, DocumentDetailOut

from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = settings.upload_dir


@router.get("", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Document).filter(Document.user_id == current_user.id).all()


@router.get("/{doc_id}", response_model=DocumentDetailOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{doc_id}/status")
def get_status(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"id": doc_id, "status": doc.processing_status}


@router.post("", response_model=DocumentOut)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "pdf"
    content = await file.read()
    size_bytes = len(content)
    size_str = f"{size_bytes / (1024 * 1024):.1f} MB"

    doc = Document(
        user_id=current_user.id,
        name=file.filename or "unknown",
        size=size_str,
        type=ext,
        tags=[],
        content="",
        processing_status="queued",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Persist raw bytes to disk for the ARQ worker to parse
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{doc.id}.{ext}")
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        doc.file_path = file_path
        db.commit()
    except Exception:
        # Fallback: store decoded text if disk write fails
        doc.content = content.decode("utf-8", errors="ignore")
        db.commit()

    # Enqueue background ingestion
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool:
        try:
            await arq_pool.enqueue_job("ingest_document", doc.id)
        except Exception:
            doc.processing_status = "ready"  # no worker — leave as-is
            db.commit()

    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}
