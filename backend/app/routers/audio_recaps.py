import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.config import settings
from app.core.deps import get_db, get_current_user
from app.core.security import decode_token
from app.models.orm import User, AudioRecap, Document
from app.schemas.schemas import AudioRecapGenerateRequest, AudioRecapOut
from app.services.generators import require_doc_context, EmptyDocumentError

_EMPTY_DOC_MSG = (
    "This document has no extracted text yet. Re-upload it (older uploads may not "
    "have been parsed) or wait for processing to finish."
)

router = APIRouter()


async def _render_recap_audio(recap: AudioRecap, script: list) -> None:
    """Render the script to a WAV via local TTS; set recap.audio_path.

    Raises on synthesis failure — the caller must mark the recap 'failed' so the
    UI is honest. We do NOT swallow the error into a fake-ready recap.
    """
    from app.voice.recap_synth import synthesize_recap
    out_path = os.path.join(settings.upload_dir, "recaps", f"{recap.id}.wav")
    recap.audio_path = await asyncio.to_thread(synthesize_recap, script, out_path)


@router.get("", response_model=List[AudioRecapOut])
def list_audio_recaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(AudioRecap).filter(AudioRecap.user_id == current_user.id).all()


@router.get("/{recap_id}", response_model=AudioRecapOut)
def get_audio_recap(
    recap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="Audio recap not found")
    return recap


@router.post("/generate", response_model=AudioRecapOut)
async def generate_audio_recap(
    req: AudioRecapGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        require_doc_context(doc)
    except EmptyDocumentError:
        raise HTTPException(status_code=422, detail=_EMPTY_DOC_MSG)

    recap = AudioRecap(
        user_id=current_user.id,
        title=f"Audio Recap: {doc.name}",
        source_document_id=doc.id,
        summary="",
        script=[],
        processing_status="queued",
    )
    db.add(recap)
    db.commit()
    db.refresh(recap)

    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool:
        try:
            await arq_pool.enqueue_job("generate_audio_recap_task", recap.id)
        except Exception:
            # No worker — generate inline as fallback
            await _generate_recap_inline(db, recap, doc)
    else:
        await _generate_recap_inline(db, recap, doc)

    return recap


async def _generate_recap_inline(db: Session, recap: AudioRecap, doc: Document) -> None:
    """Run the recap pipeline + TTS synth inline (no worker). On TTS/synthesis
    failure, mark the recap 'failed' (no fake-ready, no silent empty file)."""
    from app.services.audio_pipeline import generate_audio_recap_pipeline
    summary, script = await generate_audio_recap_pipeline(doc)
    recap.summary = summary
    recap.script = script
    try:
        await _render_recap_audio(recap, script)
    except Exception as e:
        recap.audio_path = None
        recap.summary = f"Audio synthesis failed: {e}"
        recap.processing_status = "failed"
        db.commit()
        db.refresh(recap)
        return
    recap.processing_status = "ready"
    db.commit()
    db.refresh(recap)


@router.get("/{recap_id}/audio")
def get_audio_recap_audio(
    recap_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Stream the rendered recap WAV. Auth via query token (an <audio> element
    cannot send an Authorization header)."""
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == user_id
    ).first()
    if not recap or not recap.audio_path or not os.path.exists(recap.audio_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(recap.audio_path, media_type="audio/wav", filename=f"recap-{recap_id}.wav")


@router.delete("/{recap_id}")
def delete_audio_recap(
    recap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="Audio recap not found")
    db.delete(recap)
    db.commit()
    return {"ok": True}
