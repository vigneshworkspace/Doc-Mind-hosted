from datetime import date as _Date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.orm import User, ActivityLog
from app.schemas.schemas import ActivityLogOut

router = APIRouter()


def _streaks(active_days: list[_Date], today: _Date) -> tuple[int, int]:
    """Compute (current_streak, best_streak) from a sorted list of distinct
    active dates. The current streak counts back from today (a gap of one day
    is tolerated so a streak isn't "lost" before today's activity is logged).
    """
    if not active_days:
        return 0, 0

    day_set = set(active_days)

    # Current streak: walk backwards from the most recent anchor. Anchor is
    # today if active, else yesterday, so the streak survives until end of day.
    if today in day_set:
        cursor = today
    elif (today - timedelta(days=1)) in day_set:
        cursor = today - timedelta(days=1)
    else:
        cursor = None

    current = 0
    while cursor is not None and cursor in day_set:
        current += 1
        cursor = cursor - timedelta(days=1)

    # Best streak: longest run of consecutive days anywhere in the history.
    best = 0
    run = 0
    prev = None
    for d in active_days:  # already sorted ascending
        if prev is not None and (d - prev).days == 1:
            run += 1
        else:
            run = 1
        best = max(best, run)
        prev = d

    return current, max(best, current)


@router.get("")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated activity for the dashboard: a per-day count series (drives the
    heatmap) plus the current and best streak. Computed from activity_logs with
    a real GROUP BY — multiple log rows on the same day collapse into one cell.
    """
    rows = (
        db.query(
            ActivityLog.date.label("date"),
            func.count(ActivityLog.id).label("count"),
        )
        .filter(ActivityLog.user_id == current_user.id)
        .group_by(ActivityLog.date)
        .order_by(ActivityLog.date.asc())
        .all()
    )

    days = [
        {"date": r.date.isoformat(), "count": int(r.count)}
        for r in rows
        if r.date is not None
    ]
    active_days = [r.date for r in rows if r.date is not None]

    current_streak, best_streak = _streaks(active_days, _Date.today())

    return {
        "days": days,
        "streak": current_streak,
        "best_streak": best_streak,
        "total": sum(d["count"] for d in days),
    }


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
