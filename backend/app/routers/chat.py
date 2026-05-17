from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory, Document
from app.schemas.schemas import ChatCompleteRequest, ChatCompleteResponse, ChatHistoryOut
from app.services import generators

router = APIRouter()


@router.post("/complete", response_model=ChatCompleteResponse)
async def complete(
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
    reply = await generators.chat_complete(messages, context=context)

    history_messages = messages + [{"role": "assistant", "content": reply}]
    chat_record = ChatHistory(
        user_id=current_user.id,
        document_id=req.document_id,
        messages=history_messages,
    )
    db.add(chat_record)
    db.commit()

    return ChatCompleteResponse(content=reply, model="docmind")


@router.post("/stream")
async def stream_complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming endpoint. Returns text/event-stream."""
    context = ""
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc and doc.content:
            context = doc.content

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_stream():
        async for chunk in generators.stream_chat_complete(messages, context=context):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history", response_model=List[ChatHistoryOut])
async def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )
