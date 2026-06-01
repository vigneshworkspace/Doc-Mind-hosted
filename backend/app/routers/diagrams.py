from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.services import generators

router = APIRouter()


class DiagramRequest(BaseModel):
    prompt: str
    style: str = "flowchart"


@router.post("/generate")
async def generate(
    req: DiagramRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mermaid = await generators.generate_diagram(req.prompt, req.style)
    return {"mermaid": mermaid}
