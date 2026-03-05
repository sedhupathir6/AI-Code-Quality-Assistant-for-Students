from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.security import get_current_user
from services.llm_service import get_optimization, get_optimization_fallback
from services.gamification import award_xp
from models.submission import Submission
from models.optimization import Optimization
import uuid

router = APIRouter()


@router.post("/optimize")
async def optimize_code(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    submission_id = body.get("submission_id")
    level = int(body.get("level", 1))

    if level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")

    result = await db.execute(
        select(Submission).where(Submission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    try:
        opt_data = await get_optimization(
            code=submission.original_code,
            language=submission.language,
            time_complexity=submission.time_complexity or "Unknown",
            space_complexity=submission.space_complexity or "Unknown",
            detected_patterns=submission.detected_patterns or [],
            level=level,
            submission_id=submission_id,
        )
    except Exception:
        opt_data = await get_optimization_fallback(
            submission.original_code, level, submission.detected_patterns or [], submission.language
        )

    optimization = Optimization(
        id=str(uuid.uuid4()),
        submission_id=submission_id,
        level=level,
        optimized_code=opt_data["optimized_code"],
        explanation=opt_data["explanation"],
        time_complexity_after=opt_data.get("time_complexity_after", "O(n)"),
        space_complexity_after=opt_data.get("space_complexity_after", "O(n)"),
    )
    db.add(optimization)
    await db.commit()

    # XP logic
    xp_action = f"level_{level}_optimization"
    before = submission.time_complexity or ""
    after = opt_data.get("time_complexity_after", "")
    if before == "O(n²)" and after == "O(n)":
        xp_action = "n2_to_n_improvement"
    elif before == "O(n)" and after in ("O(log n)", "O(1)"):
        xp_action = "n_to_logn_improvement"

    xp_result = await award_xp(current_user.id, xp_action, db)

    return {
        "optimization_id": str(optimization.id),
        "optimized_code": opt_data["optimized_code"],
        "explanation": opt_data["explanation"],
        "conceptual_question": opt_data.get("conceptual_question"),
        "time_complexity_after": opt_data.get("time_complexity_after"),
        "space_complexity_after": opt_data.get("space_complexity_after"),
        "xp_awarded": xp_result.get("xp_awarded", 0),
        "new_badge": xp_result.get("new_badge"),
        "total_xp": xp_result.get("total_xp", 0),
    }
