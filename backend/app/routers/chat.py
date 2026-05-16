from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory, Document
from app.schemas.schemas import ChatCompleteRequest, ChatCompleteResponse, ChatHistoryOut
from app.services import ai

router = APIRouter()


@router.post("/complete", response_model=ChatCompleteResponse)
def complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context = ""
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc and doc.content:
            context = doc.content

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    reply = ai.chat_complete(messages, context=context)

    # Persist chat history
    history_messages = messages + [{"role": "assistant", "content": reply}]
    chat_record = ChatHistory(
        user_id=current_user.id,
        document_id=req.document_id,
        messages=history_messages,
    )
    db.add(chat_record)
    db.commit()

    model_used = "claude-opus-4-7" if ai._get_client() else "demo"
    return ChatCompleteResponse(content=reply, model=model_used)


@router.get("/history", response_model=List[ChatHistoryOut])
def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )
