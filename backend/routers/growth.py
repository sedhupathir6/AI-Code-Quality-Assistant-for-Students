from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.security import get_current_user
from models.student_growth import StudentGrowth
from models.submission import Submission

router = APIRouter()


@router.get("/student/{user_id}/growth")
async def get_student_growth(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    actual_user_id = current_user.id

    result = await db.execute(
        select(StudentGrowth).where(StudentGrowth.user_id == actual_user_id)
    )
    growth = result.scalar_one_or_none()

    subs_result = await db.execute(
        select(Submission)
        .where(Submission.user_id == actual_user_id)
        .order_by(Submission.submitted_at.desc())
        .limit(20)
    )
    submissions = subs_result.scalars().all()

    complexity_trend = [
        {
            "date": str(s.submitted_at.date()) if s.submitted_at else "unknown",
            "complexity": s.time_complexity,
            "gap": s.thinking_gap_score,
        }
        for s in submissions
    ]

    if not growth:
        return {
            "xp_points": 0,
            "badges": [],
            "streak_days": 0,
            "thinking_gap_trend": [],
            "complexity_trend": complexity_trend,
            "concept_mastery": {
                "arrays": 0, "hashmaps": 0, "recursion": 0,
                "sorting": 0, "dp": 0, "trees": 0, "graphs": 0
            },
            "avg_complexity_score": 0,
        }

    return {
        "xp_points": growth.xp_points or 0,
        "badges": growth.badges or [],
        "streak_days": growth.streak_days or 0,
        "thinking_gap_trend": growth.thinking_gap_trend or [],
        "complexity_trend": complexity_trend,
        "concept_mastery": growth.concept_mastery or {
            "arrays": 0, "hashmaps": 0, "recursion": 0,
            "sorting": 0, "dp": 0, "trees": 0, "graphs": 0
        },
        "avg_complexity_score": growth.avg_complexity_score or 0,
    }


@router.post("/student/{user_id}/xp")
async def add_xp(
    user_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from services.gamification import award_xp
    action = body.get("action", "first_submission")
    result = await award_xp(current_user.id, action, db)
    return result
