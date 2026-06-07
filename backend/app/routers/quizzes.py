from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.core.deps import get_db, get_current_user
from app.models.orm import User, Quiz, Document
from app.schemas.schemas import QuizCreate, QuizGenerateRequest, QuizOut
from app.services import generators
from app.services.generators import require_doc_context, EmptyDocumentError, GenerationError

_EMPTY_DOC_MSG = (
    "This document has no extracted text yet. Re-upload it (older uploads may not "
    "have been parsed) or wait for processing to finish."
)

# Below this score (out of 100) we treat a past quiz as exposing a weak area.
_WEAK_SCORE_THRESHOLD = 70
# How many distinct weak topics we feed the model (keeps the prompt focused).
_MAX_WEAK_TOPICS = 8


class AdaptiveQuizOut(QuizOut):
    """The /generate response. Extends QuizOut with two honesty-contract fields so
    the client can tell what actually happened server-side:

      adaptive       — True only when an adaptive (weak-areas) quiz was genuinely
                        produced from real score history.
      adaptive_note  — A human-readable explanation set when adaptive was requested
                        but we fell back to a normal quiz (no usable history). Null
                        otherwise. We NEVER fabricate history to satisfy the flag.

    Non-adaptive requests leave both at their defaults (False / None)."""

    adaptive: bool = False
    adaptive_note: Optional[str] = None


def _infer_weak_topics(db: Session, user_id: int) -> list[str]:
    """Infer the learner's weak topics from their completed quiz history.

    The Quiz model stores no per-question topic/tag, so we mine the questions the
    learner most likely struggled with: questions belonging to completed quizzes
    whose overall score fell below _WEAK_SCORE_THRESHOLD. We use each question's
    text as a stand-in topic label, deduped and ranked by how often it recurs
    across weak quizzes (most-repeated = most reliably weak). Returns [] when there
    is no qualifying history — the caller MUST treat that as "no history" and fall
    back to a normal quiz rather than inventing topics."""
    weak_quizzes = (
        db.query(Quiz)
        .filter(
            Quiz.user_id == user_id,
            Quiz.completed.is_(True),
            Quiz.score.isnot(None),
            Quiz.score < _WEAK_SCORE_THRESHOLD,
        )
        .all()
    )
    counter: Counter[str] = Counter()
    for quiz in weak_quizzes:
        for q in quiz.questions or []:
            # questions is stored as JSON (snake_case dicts) — be defensive about shape.
            if not isinstance(q, dict):
                continue
            label = (q.get("question_text") or q.get("questionText") or "").strip()
            if label:
                counter[label] += 1
    return [topic for topic, _ in counter.most_common(_MAX_WEAK_TOPICS)]


router = APIRouter()


@router.get("", response_model=List[QuizOut])
def list_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Quiz).filter(Quiz.user_id == current_user.id).all()


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.post("/generate", response_model=AdaptiveQuizOut)
async def generate_quiz(
    req: QuizGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # `adaptive` is not part of QuizGenerateRequest (that schema is owned elsewhere
    # and ignores extras), so read it straight off the JSON body. Default False.
    adaptive = False
    try:
        body = await request.json()
        adaptive = bool(body.get("adaptive", False)) if isinstance(body, dict) else False
    except Exception:
        adaptive = False

    content = ""
    title = "Practice Quiz"
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        try:
            content = require_doc_context(doc)
        except EmptyDocumentError:
            raise HTTPException(status_code=422, detail=_EMPTY_DOC_MSG)
        title = f"Quiz: {doc.name}"

    is_adaptive = False
    adaptive_note = None
    try:
        if adaptive:
            weak_topics = _infer_weak_topics(db, current_user.id)
            if weak_topics:
                questions = await generators.generate_adaptive_quiz(
                    content, weak_topics, count=req.count, difficulty=req.difficulty
                )
                is_adaptive = True
                title = f"Adaptive {title}"
            else:
                # No score history to learn from — fall back to a normal quiz EXPLICITLY
                # and tell the client. We do NOT fabricate weak topics.
                questions = await generators.generate_quiz(
                    content, count=req.count, difficulty=req.difficulty
                )
                adaptive_note = (
                    "Adaptive mode needs some completed quizzes to learn your weak "
                    "areas. Take a few quizzes first — for now here's a standard quiz."
                )
        else:
            questions = await generators.generate_quiz(
                content, count=req.count, difficulty=req.difficulty
            )
    except GenerationError:
        raise HTTPException(status_code=503, detail="Quiz generation failed. Please retry.")

    # Return a transient (unsaved) quiz — client calls POST /quizzes to save
    return AdaptiveQuizOut(
        id=0,
        title=title,
        questions=questions,
        completed=False,
        score=None,
        date=date.today(),
        adaptive=is_adaptive,
        adaptive_note=adaptive_note,
    )


@router.post("", response_model=QuizOut, status_code=201)
def save_quiz(
    req: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = Quiz(
        user_id=current_user.id,
        title=req.title,
        questions=[q.model_dump() for q in req.questions],
        completed=req.completed,
        score=req.score,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()
    return {"ok": True}
