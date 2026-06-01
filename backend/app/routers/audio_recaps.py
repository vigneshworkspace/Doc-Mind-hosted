from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, AudioRecap, Document
from app.schemas.schemas import AudioRecapGenerateRequest, AudioRecapOut

router = APIRouter()


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
            from app.services.audio_pipeline import generate_audio_recap_pipeline
            summary, script = await generate_audio_recap_pipeline(doc)
            recap.summary = summary
            recap.script = script
            recap.processing_status = "ready"
            db.commit()
            db.refresh(recap)
    else:
        from app.services.audio_pipeline import generate_audio_recap_pipeline
        summary, script = await generate_audio_recap_pipeline(doc)
        recap.summary = summary
        recap.script = script
        recap.processing_status = "ready"
        db.commit()
        db.refresh(recap)

    return recap


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
