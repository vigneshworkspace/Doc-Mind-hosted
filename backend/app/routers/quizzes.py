from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.core.deps import get_db, get_current_user
from app.models.orm import User, Quiz, Document
from app.schemas.schemas import QuizCreate, QuizGenerateRequest, QuizOut
from app.services import generators

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


@router.post("/generate", response_model=QuizOut)
async def generate_quiz(
    req: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = ""
    title = "Practice Quiz"
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc:
            content = doc.content or ""
            title = f"Quiz: {doc.name}"

    questions = await generators.generate_quiz(content, count=req.count, difficulty=req.difficulty)

    # Return a transient (unsaved) QuizOut — client calls POST /quizzes to save
    return QuizOut(
        id=0,
        title=title,
        questions=questions,
        completed=False,
        score=None,
        date=date.today(),
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
