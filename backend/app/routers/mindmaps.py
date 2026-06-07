from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, MindMap, Document
from app.schemas.schemas import MindMapGenerateRequest, MindMapOut
from app.services import generators
from app.services.generators import require_doc_context, EmptyDocumentError

_EMPTY_DOC_MSG = (
    "This document has no extracted text yet. Re-upload it (older uploads may not "
    "have been parsed) or wait for processing to finish."
)

router = APIRouter()


@router.get("", response_model=List[MindMapOut])
def list_mindmaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(MindMap).filter(MindMap.user_id == current_user.id).all()


@router.get("/{map_id}", response_model=MindMapOut)
def get_mindmap(
    map_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mm = db.query(MindMap).filter(MindMap.id == map_id, MindMap.user_id == current_user.id).first()
    if not mm:
        raise HTTPException(status_code=404, detail="Mind map not found")
    return mm


@router.post("/generate", response_model=MindMapOut)
async def generate_mindmap(
    req: MindMapGenerateRequest,
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

    root = await generators.generate_mindmap(context)

    mm = MindMap(
        user_id=current_user.id,
        title=f"Mind Map: {doc.name}",
        source_document_id=doc.id,
        root=root,
    )
    db.add(mm)
    db.commit()
    db.refresh(mm)
    return mm


@router.delete("/{map_id}")
def delete_mindmap(
    map_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mm = db.query(MindMap).filter(MindMap.id == map_id, MindMap.user_id == current_user.id).first()
    if not mm:
        raise HTTPException(status_code=404, detail="Mind map not found")
    db.delete(mm)
    db.commit()
    return {"ok": True}
