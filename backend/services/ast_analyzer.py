import ast
from dataclasses import dataclass
from typing import List


@dataclass
class PatternMatch:
    name: str
    line_start: int
    line_end: int
    severity: str
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

    code_lines = code.split('\n')

    # Detect linear search inside loop
    for i, line in enumerate(code_lines):
        stripped = line.strip()
        if ' in ' in stripped and ('for ' in stripped or 'while ' in stripped):
            context = '\n'.join(code_lines[max(0, i - 5):i])
            if 'for ' in context or 'while ' in context:
                patterns.append(PatternMatch(
                    name="Linear Search in Loop",
                    line_start=i + 1,
                    line_end=i + 1,
                    severity="high",
                    suggestion="Use a set or dict for O(1) membership testing"
                ))

    # Detect recursion without memoization
    if recursive_calls and not has_memoization:
        patterns.append(PatternMatch(
            name="Recursion Without Memoization",
            line_start=1,
            line_end=len(code_lines),
            severity="medium",
            suggestion="Add @functools.lru_cache or a memoization dict to avoid recomputation"
        ))

    # Dedupe patterns by name+line
    seen = set()
    deduped = []
    for p in patterns:
        key = (p.name, p.line_start)
        if key not in seen:
            seen.add(key)
            deduped.append(p)
    patterns = deduped

    brute = sum(30 for p in patterns if p.severity == "high")
    brute += sum(15 for p in patterns if p.severity == "medium")
    thinking_gap_score = min(100.0, float(brute))

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
        "functions": len(function_names),
        "loops": loop_count,
        "max_nesting": max_nesting,
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
    )
