from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, FlashcardSet, Document
from app.schemas.schemas import FlashcardSetGenerateRequest, FlashcardSetOut
from app.services import generators
from app.services.generators import get_doc_context

router = APIRouter()


@router.get("", response_model=List[FlashcardSetOut])
def list_flashcard_sets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FlashcardSet).filter(FlashcardSet.user_id == current_user.id).all()


@router.get("/{set_id}", response_model=FlashcardSetOut)
def get_flashcard_set(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fs = db.query(FlashcardSet).filter(
        FlashcardSet.id == set_id, FlashcardSet.user_id == current_user.id
    ).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    return fs


@router.post("/generate", response_model=FlashcardSetOut)
async def generate_flashcard_set(
    req: FlashcardSetGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    cards = await generators.generate_flashcards(get_doc_context(doc))

    fs = FlashcardSet(
        user_id=current_user.id,
        title=f"Flashcards: {doc.name}",
        source_document_id=doc.id,
        cards=cards,
    )
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return fs


@router.delete("/{set_id}")
def delete_flashcard_set(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fs = db.query(FlashcardSet).filter(
        FlashcardSet.id == set_id, FlashcardSet.user_id == current_user.id
    ).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    db.delete(fs)
    db.commit()
    return {"ok": True}
