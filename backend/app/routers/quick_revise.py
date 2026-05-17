from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, QuickReviseSession, Document
from app.schemas.schemas import QuickReviseGenerateRequest, QuickReviseOut
from app.services import generators

router = APIRouter()


@router.get("", response_model=List[QuickReviseOut])
def list_quick_revise_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(QuickReviseSession).filter(QuickReviseSession.user_id == current_user.id).all()


@router.get("/{session_id}", response_model=QuickReviseOut)
def get_quick_revise_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(QuickReviseSession).filter(
        QuickReviseSession.id == session_id, QuickReviseSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quick revise session not found")
    return session


@router.post("/generate", response_model=QuickReviseOut)
async def generate_quick_revise(
    req: QuickReviseGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    points = await generators.generate_quick_revise(doc.content or "")

    session = QuickReviseSession(
        user_id=current_user.id,
        title=f"Quick Revise: {doc.name}",
        source_document_id=doc.id,
        points=points,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_quick_revise_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(QuickReviseSession).filter(
        QuickReviseSession.id == session_id, QuickReviseSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quick revise session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}
