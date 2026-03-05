from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.gamification import award_xp

router = APIRouter()


@router.post("/stress-test/save")
async def save_stress_test_results(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    results = body.get("results", [])

    if len(results) >= 3:
        runtimes = [r["runtime_ms"] for r in results if r["runtime_ms"] >= 0]
        ns = [r["n"] for r in results]

        if len(runtimes) >= 2:
            ratio = runtimes[-1] / max(runtimes[0], 0.001)
            n_ratio = ns[-1] / max(ns[0], 1)

            if ratio > n_ratio ** 1.8:
                curve = "O(n²)"
            elif ratio > n_ratio * 1.5:
                curve = "O(n log n)"
            else:
                curve = "O(n)"
        else:
            curve = "Unknown"
    else:
        curve = "Unknown"

    xp = await award_xp(current_user.id, "stress_test_completed", db)

    return {
        "scaling_curve": curve,
        "verdict": f"Empirical complexity detected: {curve}",
        "xp_awarded": xp.get("xp_awarded", 0),
    }
