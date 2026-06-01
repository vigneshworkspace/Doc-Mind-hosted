from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.services import generators

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
    return await generators.solve_visual(content, mime, prompt)
