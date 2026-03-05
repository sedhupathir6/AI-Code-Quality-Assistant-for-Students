from sqlalchemy.ext.asyncio import AsyncSession
from models.student_growth import StudentGrowth
from sqlalchemy import select
from datetime import date

XP_RULES = {
    "first_submission": 10,
    "level_1_optimization": 20,
    "level_2_optimization": 40,
    "level_3_optimization": 80,
    "correct_hint_answer": 15,
    "stress_test_completed": 25,
    "n2_to_n_improvement": 100,
    "n_to_nlogn_improvement": 50,
    "n_to_logn_improvement": 150,
    "seven_day_streak": 50,
    "daily_challenge": 30,
}


async def award_xp(user_id: str, action: str, db: AsyncSession) -> dict:
    points = XP_RULES.get(action, 0)

    result = await db.execute(
        select(StudentGrowth).where(StudentGrowth.user_id == user_id)
    )
    growth = result.scalar_one_or_none()

    if not growth:
        growth = StudentGrowth(
            user_id=user_id, xp_points=0, badges=[], streak_days=0,
            thinking_gap_trend=[], concept_mastery={}
        )
        db.add(growth)

    growth.xp_points = (growth.xp_points or 0) + points

    today = date.today()
    if growth.last_active:
        delta = (today - growth.last_active).days
        if delta == 1:
            growth.streak_days = (growth.streak_days or 0) + 1
        elif delta > 1:
            growth.streak_days = 1
    else:
        growth.streak_days = 1
    growth.last_active = today

    if growth.streak_days == 7:
        growth.xp_points += XP_RULES["seven_day_streak"]

    new_badge = await _check_badges(action, growth)
    await db.commit()

    return {
        "xp_awarded": points,
        "total_xp": growth.xp_points,
        "new_badge": new_badge,
        "streak": growth.streak_days
    }


async def _check_badges(action: str, growth: StudentGrowth) -> str | None:
    badges = list(growth.badges or [])
    new_badge = None

    if action == "n2_to_n_improvement" and "Loop Slayer" not in badges:
        badges.append("Loop Slayer")
        new_badge = "Loop Slayer"
    elif action == "level_3_optimization" and "Recursion Wizard" not in badges:
        badges.append("Recursion Wizard")
        new_badge = "Recursion Wizard"

    if (growth.streak_days or 0) >= 7 and "Streak Master" not in badges:
        badges.append("Streak Master")
        new_badge = new_badge or "Streak Master"

    growth.badges = badges
    return new_badge
