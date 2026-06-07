import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory
from app.schemas.schemas import ChatCompleteRequest, ChatHistoryOut
from app.services.rag_pipeline import answer, stream_answer, CITATIONS_KEY
from app.services.retrieval import RetrievalError

logger = logging.getLogger(__name__)
router = APIRouter()


def _save_turn(db: Session, user_id: int, document_id, query: str, reply: str) -> None:
    # Persist only the new (user, assistant) pair — not the whole cumulative history,
    # which grew every row unboundedly.
    db.add(ChatHistory(
        user_id=user_id,
        document_id=document_id,
        messages=[{"role": "user", "content": query}, {"role": "assistant", "content": reply}],
    ))
    db.commit()


# No response_model: the citations array must survive serialization. The shared
# ChatCompleteResponse schema is owned elsewhere and only declares {content, model},
# which would strip citations — so this endpoint returns the dict directly while
# keeping the same content/model keys plus citations.
@router.post("/complete")
async def complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    query = messages[-1]["content"] if messages else ""
    try:
        reply, citations = await answer(query=query, messages=messages, db=db, user_id=current_user.id, document_id=req.document_id)
    except RetrievalError as e:
        logger.error(f"Retrieval unavailable: {e}")
        raise HTTPException(status_code=503, detail="Retrieval is temporarily unavailable. Please retry.")
    _save_turn(db, current_user.id, req.document_id, query, reply)
    return {"content": reply, "model": "docmind-rag", "citations": citations}


@router.post("/stream")
async def stream_complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    query = messages[-1]["content"] if messages else ""

    async def event_stream():
        # JSON-encode every payload so embedded newlines never split an SSE frame.
        # The pipeline yields reply tokens as strings and a terminal citations dict;
        # tokens stream straight through, the dict becomes the final citations frame.
        parts = []
        citations = []
        try:
            async for chunk in stream_answer(query=query, messages=messages, db=db, user_id=current_user.id, document_id=req.document_id):
                if isinstance(chunk, dict) and CITATIONS_KEY in chunk:
                    citations = chunk[CITATIONS_KEY]
                    continue
                parts.append(chunk)
                yield f"data: {json.dumps(chunk)}\n\n"
        except RetrievalError as e:
            logger.error(f"Retrieval unavailable (stream): {e}")
            yield f"data: {json.dumps({'__error__': 'Retrieval is temporarily unavailable. Please retry.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.exception(f"Stream failed: {e}")
            yield f"data: {json.dumps({'__error__': 'DocMind is temporarily unavailable. Please retry.'})}\n\n"
            yield "data: [DONE]\n\n"
            return
        # Persist the streamed reply only on clean completion.
        reply = "".join(parts).strip()
        if reply:
            try:
                _save_turn(db, current_user.id, req.document_id, query, reply)
            except Exception as e:
                logger.warning(f"Failed to persist streamed turn: {e}")
        # Final citations frame before the terminator — grounds the streamed answer.
        yield f"data: {json.dumps({CITATIONS_KEY: citations})}\n\n"
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
