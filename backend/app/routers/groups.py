from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, StudyGroup
from app.schemas.schemas import GroupCreate, GroupOut

router = APIRouter()


@router.get("", response_model=List[GroupOut])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(StudyGroup).all()


@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.post("", response_model=GroupOut, status_code=201)
def create_group(
    req: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = StudyGroup(
        creator_id=current_user.id,
        name=req.name,
        subject=req.subject,
        description=req.description,
        next_session=req.next_session,
        members_count=1,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.post("/{group_id}/join")
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.members_count = (group.members_count or 0) + 1
    db.commit()
    return {"ok": True, "members_count": group.members_count}


@router.post("/{group_id}/leave")
def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.members_count = max(0, (group.members_count or 1) - 1)
    db.commit()
    return {"ok": True, "members_count": group.members_count}


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(StudyGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this group")
    db.delete(group)
    db.commit()
    return {"ok": True}
