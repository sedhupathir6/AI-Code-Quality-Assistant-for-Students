from pydantic import BaseModel
from typing import List, Any

class AnalyzeRequest(BaseModel):
    code: str
    language: str

class AnalyzeResponse(BaseModel):
    submission_id: str
    time_complexity: str
    space_complexity: str
    thinking_gap_score: float
    cognitive_load: str
    detected_patterns: List[Any]
    ast_summary: Any
