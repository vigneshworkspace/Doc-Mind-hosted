from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ActivityLog
from app.schemas.schemas import ActivityLogOut

router = APIRouter()


@router.get("", response_model=List[ActivityLogOut])
def list_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.date.desc())
        .all()
    )


@router.post("")
def log_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = ActivityLog(user_id=current_user.id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return ActivityLogOut.model_validate(log)
