from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.services import generators
from app.services.generators import GenerationError

router = APIRouter()


@router.post("/solve")
async def solve(
    file: UploadFile = File(...),
    prompt: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    mime = file.content_type or "image/png"
    try:
        result = await generators.solve_visual(content, mime, prompt)
    except GenerationError:
        raise HTTPException(status_code=503, detail="Visual solve failed. Please retry.")
    return {**result, "is_demo": not generators._has_provider()}
