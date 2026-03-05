from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.gamification import award_xp
from models.hint_interaction import HintInteraction
import uuid

router = APIRouter()

CORRECT_ANSWERS = {
    "What data structure gives O(1) average lookup time?": ["hashmap", "hash map", "dict", "dictionary", "set", "hash table", "hashtable"],
    "What algorithm searches a sorted array in O(log n)?": ["binary search", "bisect", "binary"],
    "What technique avoids recomputing recursive subproblems?": ["memoization", "memoisation", "dynamic programming", "dp", "caching", "cache"],
    "What does DP stand for in algorithm design?": ["dynamic programming"],
    "What is the complexity of a single for loop over n items?": ["o(n)", "linear", "n", "on"],
    "What is a Counter in Python and what does it count?": ["frequencies", "occurrences", "counts", "count"],
}


def check_answer(question: str, student_answer: str) -> bool:
    answer_lower = student_answer.strip().lower()
    correct = CORRECT_ANSWERS.get(question, [])
    if correct:
        return any(ans in answer_lower for ans in correct)
    # Fallback keyword check
    keywords = ["hashmap", "hash", "set", "dict", "binary", "memo", "cache", "dp", "greedy", "counter"]
    return any(kw in answer_lower for kw in keywords)


@router.post("/hint/answer")
async def check_hint_answer(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    question = body.get("conceptual_question", "").strip()
    student_answer = body.get("student_answer", "").strip()
    hint_level = int(body.get("hint_level", 1))
    confidence_before = int(body.get("confidence_before", 3))
    submission_id = body.get("submission_id")

    passed = check_answer(question, student_answer)

    interaction = HintInteraction(
        id=str(uuid.uuid4()),
        submission_id=submission_id,
        user_id=current_user.id,
        hint_level=hint_level,
        conceptual_question=question,
        student_answer=student_answer,
        passed=passed,
        confidence_before=confidence_before,
    )
    db.add(interaction)
    await db.commit()

    if passed:
        xp = await award_xp(current_user.id, "correct_hint_answer", db)
    else:
        xp = {"xp_awarded": 0, "new_badge": None}

    return {
        "passed": passed,
        "feedback": (
            "Correct! 🎉 You've unlocked the next optimization level." if passed
            else "Not quite. Think about which data structure gives you instant lookup without scanning every element."
        ),
        "next_level_unlocked": hint_level + 1 if passed and hint_level < 3 else None,
        "xp_awarded": xp.get("xp_awarded", 0),
    }
