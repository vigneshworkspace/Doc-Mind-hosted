"""Visualize router — single merged surface that replaces the old
diagrams + concepts routers.

POST /api/v1/visualize/generate accepts {input, kind, style?} where
kind in ("diagram", "concept"):

  - "diagram"  -> generators.generate_diagram(input, style)  (Mermaid source)
  - "concept"  -> generators.visualize_concept(input)        (Mermaid + explanation)

Both shapes are normalised into a single response:
    { "mermaid": str, "explanation": str | None, "is_demo": bool }

Error contract mirrors the other generator routers:
  - GenerationError -> HTTP 503 (a provider WAS configured but generation
    genuinely failed; the client should retry — never fabricated output).
  - When no provider is configured at all, generators emit demo data; we mark
    that with is_demo=True so the UI can show the "Demo data" badge (honesty
    contract). is_demo is read from the same _has_provider() signal the
    generators consult, so the flag stays in lock-step with the demo path.
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.services import generators
from app.services.generators import GenerationError

router = APIRouter()


class VisualizeRequest(BaseModel):
    input: str = Field(..., min_length=1, description="Prompt (diagram) or concept (concept map).")
    kind: Literal["diagram", "concept"] = "diagram"
    # Only consulted for kind == "diagram"; ignored for concept maps.
    style: str = "flowchart"


class VisualizeResponse(BaseModel):
    mermaid: str
    explanation: Optional[str] = None
    is_demo: bool = False


@router.post("/generate", response_model=VisualizeResponse)
async def generate(
    req: VisualizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if req.kind == "concept":
            result = await generators.visualize_concept(req.input)
            mermaid = result.get("mermaid", "")
            explanation = result.get("explanation")
        else:  # "diagram"
            mermaid = await generators.generate_diagram(req.input, req.style)
            explanation = None
    except GenerationError as e:
        # Provider configured but generation failed — let the client retry.
        raise HTTPException(status_code=503, detail=str(e) or "Generation failed — please retry.")

    return VisualizeResponse(
        mermaid=mermaid,
        explanation=explanation,
        # No provider configured => generators returned demo data. Surface the
        # marker so the UI can badge it honestly.
        is_demo=not generators._has_provider(),
    )
