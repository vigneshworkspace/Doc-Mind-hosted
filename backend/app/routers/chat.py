from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory
from app.schemas.schemas import ChatCompleteRequest, ChatCompleteResponse, ChatHistoryOut
from app.services.rag_pipeline import answer, stream_answer

router = APIRouter()


@router.post("/complete", response_model=ChatCompleteResponse)
async def complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    query = messages[-1]["content"] if messages else ""
    reply = await answer(query=query, messages=messages, db=db, user_id=current_user.id, document_id=req.document_id)
    db.add(ChatHistory(
        user_id=current_user.id,
        document_id=req.document_id,
        messages=messages + [{"role": "assistant", "content": reply}],
    ))
    db.commit()
    return ChatCompleteResponse(content=reply, model="docmind-rag")


@router.post("/stream")
async def stream_complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    query = messages[-1]["content"] if messages else ""

    async def event_stream():
        async for chunk in stream_answer(query=query, messages=messages, db=db, user_id=current_user.id, document_id=req.document_id):
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
