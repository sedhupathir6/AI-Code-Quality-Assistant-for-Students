import json
import hashlib
from core.redis import get_redis
from core.config import settings

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
   (d) complexity_comparison — Before vs After complexities
4. Speak to a student learning CS, not a senior developer.
5. Keep explanations under 100 words per section.
6. The conceptual_question must be answerable in 1-3 words.

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
        if isinstance(cached, bytes):
            cached = cached.decode()
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

Return ONLY this JSON structure:
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

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}]
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        result = json.loads(raw)
        await redis.setex(cache_key, 3600, json.dumps(result))
        return result
    except Exception as e:
        raise RuntimeError(f"LLM call failed: {e}")


FALLBACK_OPTIMIZATIONS = {
    1: {
        "optimized_code": '''def find_duplicates(arr: list) -> list:
    """Return list of duplicate elements in arr."""
    duplicates = []
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j] and arr[i] not in duplicates:
                duplicates.append(arr[i])
    return duplicates''',
        "explanation": {
            "why_inefficient": "The algorithm logic hasn't changed yet, but we've improved code readability: added a type hint and docstring.",
            "pattern_replaced": "No pattern change at Level 1 — this is cleanup only.",
            "why_better": "Clean code is easier to reason about and maintain. Complexity is still O(n²).",
            "complexity_comparison": {"before": "O(n²) time, O(n) space", "after": "O(n²) time, O(n) space (unchanged)"}
        },
        "conceptual_question": "What data structure gives O(1) average lookup time?",
        "time_complexity_after": "O(n²)",
        "space_complexity_after": "O(n)",
    },
    2: {
        "optimized_code": '''def find_duplicates(arr: list) -> list:
    """Return list of duplicate elements using a set for O(1) lookup."""
    seen = set()
    duplicates = []
    for item in arr:
        if item in seen and item not in duplicates:
            duplicates.append(item)
        seen.add(item)
    return duplicates''',
        "explanation": {
            "why_inefficient": "Your original code has a nested loop: for each element, it scans the rest of the array. That's O(n) work repeated n times = O(n²) total.",
            "pattern_replaced": "Nested loop with linear scan → single pass with Set lookup",
            "why_better": "A Python set stores elements in a hash table. Checking 'item in seen' is O(1) on average, not O(n). So the whole function runs in O(n) instead of O(n²).",
            "complexity_comparison": {"before": "O(n²) time, O(n) space", "after": "O(n) time, O(n) space"}
        },
        "conceptual_question": "What data structure gives O(1) average lookup time?",
        "time_complexity_after": "O(n)",
        "space_complexity_after": "O(n)",
    },
    3: {
        "optimized_code": '''from collections import Counter

def find_duplicates(arr: list) -> list:
    """Return list of duplicate elements using Counter for clean O(n) solution."""
    return [item for item, count in Counter(arr).items() if count > 1]''',
        "explanation": {
            "why_inefficient": "Even the set-based O(n) solution uses explicit loops and mutation. Python's Counter does the frequency counting in one pass internally.",
            "pattern_replaced": "Manual loop + set → Counter (hash map frequency analysis)",
            "why_better": "Counter is implemented in C under the hood, making it faster in practice. The list comprehension is also more Pythonic and readable.",
            "complexity_comparison": {"before": "O(n) time (set version)", "after": "O(n) time, cleaner + faster in practice"}
        },
        "conceptual_question": "What is a Counter in Python and what does it count?",
        "time_complexity_after": "O(n)",
        "space_complexity_after": "O(n)",
    },
}


async def analyze_code_llm(code: str, language: str) -> dict:
    """Analyze code complexity and patterns using LLM (for non-python or complex cases)."""
    cache_key = f"analysis:{hashlib.md5(f'{code}{language}'.encode()).hexdigest()}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        if isinstance(cached, bytes):
            cached = cached.decode()
        return json.loads(cached)

    user_prompt = f"""Analyze this {language} code for performance and cognitive load.
    
    STUDENT'S CODE:
    ```{language}
    {code}
    ```
    
    Return ONLY this JSON structure:
    {{
      "time_complexity": "e.g. O(n^2)",
      "space_complexity": "e.g. O(n)",
      "thinking_gap_score": 0.0 to 100.0,
      "cognitive_load": "Low/Medium/High",
      "detected_patterns": [
        {{
          "name": "e.g. Nested Loops",
          "line_start": 1,
          "line_end": 5,
          "severity": "high/medium/low",
          "suggestion": "how to improve it"
        }}
      ],
      "ast_summary": {{
        "summary": "short description of code structure"
      }}
    }}"""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1000,
            system="You are an expert CS tutor specializing in performance analysis. Return ONLY valid JSON.",
            messages=[{"role": "user", "content": user_prompt}]
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        await redis.setex(cache_key, 3600, json.dumps(result))
        return result
    except Exception as e:
        # Simple fallback if LLM fails
        return {
            "time_complexity": "O(n)",
            "space_complexity": "O(n)",
            "thinking_gap_score": 50.0,
            "cognitive_load": "Medium",
            "detected_patterns": [],
            "ast_summary": {"summary": "Analysis unavailable"}
        }


async def get_optimization_fallback(code: str, level: int, patterns: list, language: str = "python") -> dict:
    if language == "python":
        return FALLBACK_OPTIMIZATIONS.get(level, FALLBACK_OPTIMIZATIONS[2])
    
    # Generic fallback for other languages if LLM fails
    return {
        "optimized_code": code,
        "explanation": {
            "why_inefficient": "Unable to generate specific optimization at this time.",
            "pattern_replaced": "None",
            "why_better": "Please try again or check your code structure.",
            "complexity_comparison": {"before": "Unknown", "after": "Unknown"}
        },
        "conceptual_question": "What is the Big O complexity of your current solution?",
        "time_complexity_after": "O(n)",
        "space_complexity_after": "O(n)",
    }
