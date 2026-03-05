import os
base = r"c:/Users/Sedhupathi/Desktop/technano/"
def write_file(path, content):
    full_path = os.path.join(base, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

write_file("backend/services/ast_analyzer.py", '''import ast
import re
from dataclasses import dataclass
from typing import List

@dataclass
class PatternMatch:
    name: str
    line_start: int
    line_end: int
    severity: str  # "high" | "medium" | "low"
    suggestion: str

@dataclass
class AnalysisResult:
    time_complexity: str
    space_complexity: str
    thinking_gap_score: float
    cognitive_load: str
    detected_patterns: List[PatternMatch]
    ast_summary: dict

def analyze_python_code(code: str) -> AnalysisResult:
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ValueError(f"Syntax error in code: {e}")

    patterns = []
    max_nesting = 0
    loop_count = 0
    recursive_calls = set()
    function_names = set()
    has_memoization = False

    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.nesting = 0
            self.current_function = None

        def visit_FunctionDef(self, node):
            function_names.add(node.name)
            prev = self.current_function
            self.current_function = node.name
            self.generic_visit(node)
            self.current_function = prev

        def visit_For(self, node):
            nonlocal max_nesting, loop_count
            loop_count += 1
            self.nesting += 1
            max_nesting = max(max_nesting, self.nesting)
            if self.nesting >= 2:
                patterns.append(PatternMatch(
                    name="Nested Loop Detected",
                    line_start=node.lineno,
                    line_end=getattr(node, "end_lineno", node.lineno),
                    severity="high",
                    suggestion="Consider replacing inner loop with a hashmap/set for O(1) lookup"
                ))
            self.generic_visit(node)
            self.nesting -= 1

        def visit_While(self, node):
            nonlocal loop_count
            loop_count += 1
            self.generic_visit(node)

        def visit_Call(self, node):
            nonlocal has_memoization
            if isinstance(node.func, ast.Name):
                if node.func.id == self.current_function:
                    recursive_calls.add(self.current_function)
            if isinstance(node.func, ast.Attribute):
                if node.func.attr in ('lru_cache', 'cache'):
                    has_memoization = True
            self.generic_visit(node)

    visitor = Visitor()
    visitor.visit(tree)

    code_lines = code.split('\\n')
    for i, line in enumerate(code_lines):
        if 'in ' in line and ('for ' in line or 'while ' in line):
            if any(f'for ' in code_lines[j] for j in range(max(0, i-5), i)):
                patterns.append(PatternMatch(
                    name="Linear Search in Loop",
                    line_start=i+1,
                    line_end=i+1,
                    severity="high",
                    suggestion="Use a set or dict for O(1) membership testing"
                ))

    if recursive_calls and not has_memoization:
        patterns.append(PatternMatch(
            name="Recursion Without Memoization",
            line_start=1,
            line_end=len(code_lines),
            severity="medium",
            suggestion="Add @functools.lru_cache or memoization dict to avoid recomputation"
        ))

    brute_indicators = sum(1 for p in patterns if p.severity == "high") * 30
    brute_indicators += sum(1 for p in patterns if p.severity == "medium") * 15
    thinking_gap_score = min(100.0, float(brute_indicators))

    if max_nesting >= 3:
        time_complexity = "O(n³)"
    elif max_nesting == 2:
        time_complexity = "O(n²)"
    elif recursive_calls and not has_memoization:
        time_complexity = "O(2ⁿ)"
    elif loop_count == 1:
        time_complexity = "O(n)"
    elif loop_count == 0:
        time_complexity = "O(1)"
    else:
        time_complexity = "O(n log n)"

    space_complexity = "O(n)" if any(
        isinstance(node, (ast.List, ast.Dict, ast.Set))
        for node in ast.walk(tree)
    ) else "O(1)"

    if thinking_gap_score >= 60:
        cognitive_load = "High"
    elif thinking_gap_score >= 30:
        cognitive_load = "Medium"
    else:
        cognitive_load = "Low"

    ast_summary = {
        "total_lines": len(code_lines),
        "function_count": len(function_names),
        "loop_count": loop_count,
        "max_nesting_depth": max_nesting,
        "has_recursion": bool(recursive_calls),
        "has_memoization": has_memoization,
    }

    return AnalysisResult(
        time_complexity=time_complexity,
        space_complexity=space_complexity,
        thinking_gap_score=thinking_gap_score,
        cognitive_load=cognitive_load,
        detected_patterns=patterns,
        ast_summary=ast_summary,
    )''')

write_file("backend/services/llm_service.py", '''import anthropic
import json
import hashlib
from core.redis import get_redis
from core.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

LEVEL_DESCRIPTIONS = {
    1: "Code Cleanup — fix naming, formatting, remove redundancy. No algorithmic change.",
    2: "Complexity Improvement — replace nested loops with hashmaps, improve from O(n²) to O(n).",
    3: "Algorithm Redesign — apply DP, divide & conquer, or greedy for best theoretical complexity.",
}

SYSTEM_PROMPT = """You are CCE — Cognitive Code Evolution — an AI educational code mentor for students.

Your job is NOT to just fix code. Your job is to guide students to UNDERSTAND why their code is inefficient and HOW to think better.

RULES:
1. Never just hand over the answer without explanation.
2. Use the Socratic method — always end with a conceptual question the student must answer to unlock the next level.
3. Structure every optimization explanation in EXACTLY 4 parts:
   (a) why_inefficient — explain the bottleneck in plain language
   (b) pattern_replaced — name the CS pattern being replaced (e.g. "nested loop → hashmap lookup")
   (c) why_better — explain the improvement with complexity reasoning
   (d) complexity_comparison — "Before: O(n²) time | After: O(n) time"
4. Speak to a student learning CS, not a senior developer.
5. Keep explanations under 100 words per section.
6. The conceptual_question must be answerable in 1-3 words (e.g. "hashmap", "binary search", "memoization").

RETURN ONLY VALID JSON. No markdown, no backticks, no preamble."""

async def get_optimization(
    code: str,
    language: str,
    time_complexity: str,
    space_complexity: str,
    detected_patterns: list,
    level: int,
    submission_id: str,
) -> dict:
    cache_key = f"opt:{hashlib.md5(f'{code}{level}'.encode()).hexdigest()}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    patterns_str = ", ".join([p.get("name", "") for p in detected_patterns]) or "none detected"

    user_prompt = f"""Analyze this {language} code and produce a Level {level} optimization.

Level {level} means: {LEVEL_DESCRIPTIONS[level]}

STUDENT'S CODE:
```{language}
{code}
```

CURRENT ANALYSIS:
- Time Complexity: {time_complexity}
- Space Complexity: {space_complexity}
- Detected Patterns: {patterns_str}

Produce the optimized code and explanation. Return ONLY this JSON structure:
{{
  "optimized_code": "the complete optimized code here",
  "explanation": {{
    "why_inefficient": "explain why the original code is slow",
    "pattern_replaced": "name the pattern being replaced",
    "why_better": "explain why the new version is better",
    "complexity_comparison": {{
      "before": "{time_complexity} time, {space_complexity} space",
      "after": "new complexity here"
    }}
  }},
  "conceptual_question": "one question the student must answer to unlock the next level",
  "time_complexity_after": "e.g. O(n)",
  "space_complexity_after": "e.g. O(n)"
}}"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    result = json.loads(raw)
    await redis.setex(cache_key, 3600, json.dumps(result))
    return result

FALLBACK_EXPLANATIONS = {
    "Nested Loop Detected": {
        "why_inefficient": "Your code uses nested loops, meaning for every element it checks every other element. This is O(n²) — it gets very slow as input grows.",
        "pattern_replaced": "Nested loop → hashmap/set lookup",
        "why_better": "A Python set or dict gives O(1) lookup time instead of O(n), reducing total complexity from O(n²) to O(n).",
        "complexity_comparison": {"before": "O(n²) time", "after": "O(n) time"},
    }
}

async def get_optimization_fallback(code: str, level: int, patterns: list) -> dict:
    pattern_name = patterns[0]["name"] if patterns else "Nested Loop Detected"
    explanation = FALLBACK_EXPLANATIONS.get(pattern_name, FALLBACK_EXPLANATIONS["Nested Loop Detected"])
    opt_code = f"def find_duplicates(arr):\\n    duplicates = []\\n    seen = set()\\n    for item in arr:\\n        if item in seen and item not in duplicates:\\n            duplicates.append(item)\\n        seen.add(item)\\n    return duplicates\\n"
    if level == 1:
        opt_code = code

    return {
        "optimized_code": opt_code,
        "explanation": explanation,
        "conceptual_question": "What data structure gives O(1) average lookup time?",
        "time_complexity_after": "O(n)",
        "space_complexity_after": "O(n)",
    }''')

write_file("backend/services/gamification.py", '''from sqlalchemy.ext.asyncio import AsyncSession
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
    if points == 0:
        return {"xp_awarded": 0, "new_badge": None}

    result = await db.execute(select(StudentGrowth).where(StudentGrowth.user_id == user_id))
    growth = result.scalar_one_or_none()

    if not growth:
        growth = StudentGrowth(user_id=user_id, xp_points=0, badges=[], streak_days=0)
        db.add(growth)

    growth.xp_points += points

    today = date.today()
    if growth.last_active:
        delta = (today - growth.last_active).days
        if delta == 1:
            growth.streak_days += 1
        elif delta > 1:
            growth.streak_days = 1
    else:
        growth.streak_days = 1
    growth.last_active = today

    if growth.streak_days == 7:
        growth.xp_points += XP_RULES["seven_day_streak"]

    new_badge = await check_badges(user_id, action, growth, db)

    await db.commit()
    return {"xp_awarded": points, "total_xp": growth.xp_points, "new_badge": new_badge, "streak": growth.streak_days}

async def check_badges(user_id: str, action: str, growth: StudentGrowth, db: AsyncSession):
    badges = growth.badges or []
    new_badge = None

    if action == "n2_to_n_improvement" and "Loop Slayer" not in badges:
        badges.append("Loop Slayer")
        new_badge = "Loop Slayer"

    if action == "level_3_optimization" and "Recursion Wizard" not in badges:
        badges.append("Recursion Wizard")
        new_badge = "Recursion Wizard"

    if growth.streak_days >= 7 and "Streak Master" not in badges:
        badges.append("Streak Master")
        new_badge = "Streak Master"

    growth.badges = list(badges)
    return new_badge''')

write_file("backend/routers/analyze.py", '''from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.ast_analyzer import analyze_python_code
from services.gamification import award_xp
from models.submission import Submission
from schemas.submission import AnalyzeRequest, AnalyzeResponse
import uuid

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_code(
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if body.language == "python":
        try:
            result = analyze_python_code(body.code)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Only Python supported in MVP. JS/Java coming soon.")

    submission = Submission(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        language=body.language,
        original_code=body.code,
        time_complexity=result.time_complexity,
        space_complexity=result.space_complexity,
        thinking_gap_score=result.thinking_gap_score,
        cognitive_load=result.cognitive_load,
        detected_patterns=[
            {"name": p.name, "line_start": p.line_start, "line_end": p.line_end,
             "severity": p.severity, "suggestion": p.suggestion}
            for p in result.detected_patterns
        ],
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    await award_xp(current_user.id, "first_submission", db)

    return AnalyzeResponse(
        submission_id=str(submission.id),
        time_complexity=result.time_complexity,
        space_complexity=result.space_complexity,
        thinking_gap_score=result.thinking_gap_score,
        cognitive_load=result.cognitive_load,
        detected_patterns=[
            {"name": p.name, "line_start": p.line_start, "line_end": p.line_end,
             "severity": p.severity, "suggestion": p.suggestion}
            for p in result.detected_patterns
        ],
        ast_summary=result.ast_summary,
    )''')

write_file("backend/routers/optimize.py", '''from fastapi import APIRouter, Depends, HTTPException
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
    current_user = Depends(get_current_user),
):
    submission_id = body.get("submission_id")
    level = body.get("level", 1)

    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    try:
        opt_data = await get_optimization(
            code=submission.original_code,
            language=submission.language,
            time_complexity=submission.time_complexity,
            space_complexity=submission.space_complexity,
            detected_patterns=submission.detected_patterns or [],
            level=level,
            submission_id=submission_id,
        )
    except Exception:
        opt_data = await get_optimization_fallback(
            submission.original_code, level, submission.detected_patterns or []
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

    xp_action = f"level_{level}_optimization"
    if submission.time_complexity == "O(n²)" and opt_data.get("time_complexity_after") == "O(n)":
        xp_action = "n2_to_n_improvement"
    await award_xp(current_user.id, xp_action, db)

    return {
        "optimization_id": str(optimization.id),
        "optimized_code": opt_data["optimized_code"],
        "explanation": opt_data["explanation"],
        "conceptual_question": opt_data.get("conceptual_question"),
        "time_complexity_after": opt_data.get("time_complexity_after"),
        "space_complexity_after": opt_data.get("space_complexity_after"),
    }''')

write_file("backend/routers/hints.py", '''from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.gamification import award_xp
from models.hint_interaction import HintInteraction
import uuid

router = APIRouter()

CORRECT_ANSWERS = {
    "What data structure gives O(1) average lookup time?": ["hashmap", "hash map", "dict", "dictionary", "set"],
    "What algorithm searches a sorted array in O(log n)?": ["binary search", "bisect"],
    "What technique avoids recomputing recursive subproblems?": ["memoization", "dynamic programming", "dp", "caching"],
    "What does DP stand for in algorithm design?": ["dynamic programming"],
    "What is the complexity of a single for loop over n items?": ["o(n)", "linear", "n"],
}

@router.post("/hint/answer")
async def check_hint_answer(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    question = body.get("conceptual_question", "").strip()
    student_answer = body.get("student_answer", "").strip().lower()
    hint_level = body.get("hint_level", 1)
    confidence_before = body.get("confidence_before", 3)
    submission_id = body.get("submission_id")

    correct_answers = CORRECT_ANSWERS.get(question, [])
    passed = any(ans in student_answer for ans in correct_answers)

    if not correct_answers:
        keywords = ["hashmap", "hash", "set", "dict", "binary", "memo", "cache", "dp", "greedy"]
        passed = any(kw in student_answer for kw in keywords)

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
        await award_xp(current_user.id, "correct_hint_answer", db)

    return {
        "passed": passed,
        "feedback": "Correct! You've unlocked the next optimization level." if passed
                    else "Not quite. Think about which data structure gives you instant lookup without scanning every element.",
        "next_level_unlocked": hint_level + 1 if passed and hint_level < 3 else None,
    }''')

write_file("backend/routers/stress_test.py", '''from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.gamification import award_xp

router = APIRouter()

@router.post("/stress-test/save")
async def save_stress_test_results(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    results = body.get("results", [])
    submission_id = body.get("submission_id")

    if len(results) >= 3:
        runtimes = [r["runtime_ms"] for r in results]
        ns = [r["n"] for r in results]
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

    await award_xp(current_user.id, "stress_test_completed", db)

    return {
        "scaling_curve": curve,
        "results": results,
        "verdict": f"Empirical complexity detected: {curve}",
    }''')

write_file("backend/routers/growth.py", '''from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.security import get_current_user
from models.student_growth import StudentGrowth
from models.submission import Submission

router = APIRouter()

@router.get("/student/{user_id}/growth")
async def get_student_growth(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    real_user_id = current_user.id
    result = await db.execute(select(StudentGrowth).where(StudentGrowth.user_id == real_user_id))
    growth = result.scalar_one_or_none()

    if not growth:
        return {
            "xp_points": 0, "badges": [], "streak_days": 0,
            "thinking_gap_trend": [], "concept_mastery": {},
            "avg_complexity_score": 0,
            "complexity_trend": []
        }

    subs = await db.execute(
        select(Submission)
        .where(Submission.user_id == real_user_id)
        .order_by(Submission.submitted_at.desc())
        .limit(20)
    )
    submissions = subs.scalars().all()

    complexity_trend = [
        {"date": str(s.submitted_at.date()), "complexity": s.time_complexity, "gap": s.thinking_gap_score}
        for s in submissions
    ]

    return {
        "xp_points": growth.xp_points,
        "badges": growth.badges or [],
        "streak_days": growth.streak_days,
        "thinking_gap_trend": growth.thinking_gap_trend or [],
        "complexity_trend": complexity_trend,
        "concept_mastery": growth.concept_mastery or {},
        "avg_complexity_score": growth.avg_complexity_score,
    }''')

print("Backend routines generated.")
