from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.security import get_current_user
from models.submission import Submission
from models.student_growth import StudentGrowth

router = APIRouter()


@router.get("/instructor/{instructor_id}/class-summary")
async def get_class_summary(
    instructor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Demo data for the hackathon
    return {
        "total_students": 24,
        "avg_thinking_gap": 52.3,
        "top_errors": [
            "Nested Loop Detected",
            "Linear Search in Loop",
            "Recursion Without Memoization",
        ],
        "complexity_distribution": {
            "O(n²)": 12,
            "O(n)": 8,
            "O(n log n)": 3,
            "O(1)": 1,
        },
        "students": [
            {"name": "Alice", "submissions": 8, "avg_complexity": "O(n)", "xp": 420, "gap_trend": "↓"},
            {"name": "Bob", "submissions": 5, "avg_complexity": "O(n²)", "xp": 180, "gap_trend": "→"},
            {"name": "Carol", "submissions": 12, "avg_complexity": "O(n log n)", "xp": 680, "gap_trend": "↓"},
        ],
    }
