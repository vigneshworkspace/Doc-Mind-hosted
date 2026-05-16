from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import User, UserSettings
from app.schemas.schemas import SettingsPatch, SettingsOut

router = APIRouter()


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.patch("", response_model=SettingsOut)
def patch_settings(
    req: SettingsPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.flush()

    updates = req.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
