from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.orm import (
    User,
    UserSettings,
    Document,
    Quiz,
    FlashcardSet,
    MindMap,
    AudioRecap,
    QuickReviseSession,
    Note,
    StudyGroup,
    ActivityLog,
    Chunk,
    ChatHistory,
)
from app.schemas.schemas import SettingsPatch, SettingsOut

router = APIRouter()

# Every per-user content table to wipe on reset. The user account row and the
# user_settings row are intentionally NOT in this list — reset clears content,
# not the account. StudyGroup is keyed by creator_id; everything else by user_id.
_USER_CONTENT_MODELS = (
    Quiz,
    FlashcardSet,
    MindMap,
    AudioRecap,
    QuickReviseSession,
    Note,
    ChatHistory,
    ActivityLog,
    Chunk,
    Document,  # last: chunks FK -> documents, so children go first
)


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


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete all of the current user's content (documents, quizzes,
    flashcards, mind maps, recaps, quick-revise sessions, notes, study groups,
    chat history, chunks, and activity logs). The account and its settings are
    preserved. One transaction — either it all goes or nothing does."""
    for model in _USER_CONTENT_MODELS:
        db.query(model).filter(model.user_id == current_user.id).delete(synchronize_session=False)
    db.query(StudyGroup).filter(StudyGroup.creator_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return None
