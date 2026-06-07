import os
import mimetypes

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
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


# Media types we set explicitly so the browser/PDF.js gets the right Content-Type.
# Anything else falls back to mimetypes.guess_type, then octet-stream.
_FILE_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
}


@router.get("/{doc_id}/file")
def get_document_file(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the original uploaded file (PDF/txt/docx) for in-app viewing.

    Auth is the standard Bearer dependency — the frontend fetches this as a blob
    with the Authorization header and hands the bytes to PDF.js, so we deliberately
    do NOT support a query-param token here.
    """
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Original file is not stored for this document")

    ext = (doc.type or "").lower().lstrip(".")
    media = _FILE_MEDIA_TYPES.get(ext) or mimetypes.guess_type(doc.file_path)[0] or "application/octet-stream"
    # inline so a browser preview renders instead of forcing a download.
    return FileResponse(
        doc.file_path,
        media_type=media,
        headers={"Content-Disposition": f'inline; filename="{(doc.name or f"document-{doc_id}").replace(chr(34), "")}"'},
    )


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

    # Enqueue background ingestion, or fall back to inline parsing when there is
    # no ARQ/Redis worker. Inline keeps a single-process / no-Redis run usable:
    # the doc actually gets parsed instead of sitting at 'queued' forever.
    arq_pool = getattr(request.app.state, "arq_pool", None)
    enqueued = False
    if arq_pool:
        try:
            await arq_pool.enqueue_job("ingest_document", doc.id)
            enqueued = True
        except Exception:
            enqueued = False

    if not enqueued:
        doc_id = doc.id
        # _run_ingest owns its own DB session and never re-raises: it marks the
        # doc 'ready' on success or 'failed' on error, so the upload response
        # itself can never be broken by a bad parse/LLM call.
        try:
            from app.workers.ingest import _run_ingest
            await _run_ingest(doc_id)
        except Exception:
            # Defensive: even an import/scheduling error must not 500 the upload.
            pass
        # Reload to surface the status written by the inline run (it used a
        # separate session, so our `doc` is stale).
        db.expire_all()
        refreshed = db.get(Document, doc_id)
        if refreshed is not None:
            doc = refreshed

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
