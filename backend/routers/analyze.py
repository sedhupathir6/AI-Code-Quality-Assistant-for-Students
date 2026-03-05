from fastapi import APIRouter, Depends, HTTPException
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
    current_user=Depends(get_current_user),
):
    if body.language == "python":
        try:
            # Fast path for Python using AST
            result = analyze_python_code(body.code)
            ast_summary = result.ast_summary
            detected_patterns_raw = result.detected_patterns
            time_complexity = result.time_complexity
            space_complexity = result.space_complexity
            thinking_gap_score = result.thinking_gap_score
            cognitive_load = result.cognitive_load
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # LLM path for Java, C++, JS, etc.
        from services.llm_service import analyze_code_llm
        from services.ast_analyzer import PatternMatch
        
        llm_result = await analyze_code_llm(body.code, body.language)
        ast_summary = llm_result.get("ast_summary", {})
        
        detected_patterns_raw = []
        for p in llm_result.get("detected_patterns", []):
            try:
                # Fill missing attributes if they're not provided by LLM
                pattern = PatternMatch(
                    name=p.get("name", "Unknown Pattern"),
                    line_start=p.get("line_start", 1),
                    line_end=p.get("line_end", 1),
                    severity=p.get("severity", "medium"),
                    suggestion=p.get("suggestion", "Please review this code block")
                )
                detected_patterns_raw.append(pattern)
            except Exception:
                pass

        time_complexity = llm_result.get("time_complexity", "O(n)")
        space_complexity = llm_result.get("space_complexity", "O(n)")
        thinking_gap_score = llm_result.get("thinking_gap_score", 50.0)
        cognitive_load = llm_result.get("cognitive_load", "Medium")

    submission = Submission(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        language=body.language,
        original_code=body.code,
        time_complexity=time_complexity,
        space_complexity=space_complexity,
        thinking_gap_score=thinking_gap_score,
        cognitive_load=cognitive_load,
        detected_patterns=[
            {
                "name": p.name,
                "line_start": p.line_start,
                "line_end": p.line_end,
                "severity": p.severity,
                "suggestion": p.suggestion,
            }
            for p in detected_patterns_raw
        ],
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    await award_xp(current_user.id, "first_submission", db)

    return AnalyzeResponse(
        submission_id=str(submission.id),
        time_complexity=time_complexity,
        space_complexity=space_complexity,
        thinking_gap_score=thinking_gap_score,
        cognitive_load=cognitive_load,
        detected_patterns=[
            {
                "name": p.name,
                "line_start": p.line_start,
                "line_end": p.line_end,
                "severity": p.severity,
                "suggestion": p.suggestion,
            }
            for p in detected_patterns_raw
        ],
        ast_summary=ast_summary,
    )
