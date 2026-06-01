from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.services import generators

router = APIRouter()


class ConceptRequest(BaseModel):
    concept: str


@router.post("/visualize")
async def visualize(
    req: ConceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await generators.visualize_concept(req.concept)
