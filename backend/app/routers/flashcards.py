from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, FlashcardSet, Document
from app.schemas.schemas import FlashcardSetGenerateRequest, FlashcardSetOut
from app.services import generators
from app.services.generators import require_doc_context, EmptyDocumentError, GenerationError

_EMPTY_DOC_MSG = (
    "This document has no extracted text yet. Re-upload it (older uploads may not "
    "have been parsed) or wait for processing to finish."
)

# SM-2-style interval multipliers. "again" resets to a 1-day interval; the others
# grow the current interval. Kept deliberately simple (no per-card ease factor).
_GRADE_FACTORS = {"hard": 1.2, "good": 2.5, "easy": 3.5}
_VALID_GRADES = {"again", *_GRADE_FACTORS}


class ReviewRequest(BaseModel):
    card_index: int
    grade: str


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
    try:
        context = require_doc_context(doc)
    except EmptyDocumentError:
        raise HTTPException(status_code=422, detail=_EMPTY_DOC_MSG)

    try:
        cards = await generators.generate_flashcards(context)
    except GenerationError:
        raise HTTPException(status_code=503, detail="Flashcard generation failed. Please retry.")
    if not cards:
        raise HTTPException(status_code=503, detail="Flashcard generation returned nothing. Please retry.")

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


@router.post("/{set_id}/review")
def review_flashcard(
    set_id: int,
    req: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a spaced-repetition rating for one card and reschedule it.

    Scheduling state (interval in days + next_review ISO date) is stored INSIDE
    the existing cards JSON — no extra column. Returns the updated card so the
    client can re-order the study queue by next-due. FlashcardSetOut would strip
    these fields, so we return a plain dict here.
    """
    grade = req.grade
    if grade not in _VALID_GRADES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid grade '{grade}'. Use one of: again, hard, good, easy.",
        )

    fs = db.query(FlashcardSet).filter(
        FlashcardSet.id == set_id, FlashcardSet.user_id == current_user.id
    ).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Flashcard set not found")

    cards = fs.cards or []
    if not (0 <= req.card_index < len(cards)):
        raise HTTPException(status_code=404, detail="Card index out of range")

    card = cards[req.card_index]
    prev_interval = card.get("interval") or 1

    if grade == "again":
        interval = 1
    else:
        # Round to whole days, min 1, so intervals stay human-readable.
        interval = max(1, round(prev_interval * _GRADE_FACTORS[grade]))

    next_review = (date.today() + timedelta(days=interval)).isoformat()
    card["interval"] = interval
    card["next_review"] = next_review
    cards[req.card_index] = card

    # JSON column is mutated in place — mark dirty so SQLAlchemy persists it.
    fs.cards = cards
    flag_modified(fs, "cards")
    db.commit()

    return {
        "card_index": req.card_index,
        "grade": grade,
        "interval": interval,
        "next_review": next_review,
    }


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
