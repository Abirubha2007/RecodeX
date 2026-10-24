"""
Time and space complexity estimation service.

Uses AST analysis for Python and conservative heuristics for C.
Returns Unknown or qualified estimates when the analysis is uncertain.
"""

from __future__ import annotations

import ast
import re
import logging
from typing import List, Tuple

from app.schemas import ComplexityEstimate

logger = logging.getLogger("recodex.complexity")

UNKNOWN = "Unknown"


def _python_complexity(source_code: str) -> ComplexityEstimate:
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return ComplexityEstimate(
            estimated_time_complexity=UNKNOWN,
            estimated_auxiliary_space=UNKNOWN,
            confidence="low",
            reasoning="Code has a syntax error; complexity cannot be estimated.",
            assumptions=[],
            limitations="Fix the syntax error first.",
        )

    # Count loop nesting depth
    max_loop_depth = _max_loop_depth(tree)
    has_recursion = _has_recursion(tree)
    has_sort = _has_sort_call(tree)
    has_binary_pattern = _has_logarithmic_pattern(tree)
    has_dict_set_ops = _has_dict_set_ops(tree)

    reasoning_parts: List[str] = []
    assumptions: List[str] = []
    time_complexity = UNKNOWN
    space_complexity = "O(1)"

    if has_recursion:
        time_complexity = UNKNOWN
        space_complexity = UNKNOWN
        reasoning_parts.append("Recursive calls detected; complexity depends on depth and branching factor.")
        assumptions.append("Recursion depth and branching factor are unknown without input size.")
    elif has_sort:
        time_complexity = "O(n log n)"
        reasoning_parts.append("Built-in sort (typically Timsort) detected, which is O(n log n).")
        assumptions.append("n is the size of the sorted collection.")
    elif max_loop_depth == 0:
        time_complexity = "O(1)"
        reasoning_parts.append("No loops or recursion detected; all operations appear constant-time.")
    elif max_loop_depth == 1:
        if has_binary_pattern:
            time_complexity = "O(log n)"
            reasoning_parts.append("Single loop with halving pattern detected, suggesting O(log n).")
        else:
            time_complexity = "O(n)"
            reasoning_parts.append("Single top-level loop detected, suggesting linear O(n) traversal.")
        assumptions.append("Loop iterates over an input of size n.")
    elif max_loop_depth == 2:
        time_complexity = "O(n²)"
        reasoning_parts.append("Two nested loops detected, suggesting O(n²) in the worst case.")
        assumptions.append("Both loops iterate proportionally to the input size n.")
    elif max_loop_depth >= 3:
        time_complexity = f"O(n^{max_loop_depth})"
        reasoning_parts.append(f"{max_loop_depth} nested loops detected, suggesting polynomial complexity.")

    # Space complexity heuristics
    if has_dict_set_ops:
        space_complexity = "O(n)"
        reasoning_parts.append("Dictionary or set used; auxiliary space may be O(n).")
    elif max_loop_depth > 0 and not has_recursion:
        # Check for list/array creation
        space_complexity = "O(1) to O(n)"
        reasoning_parts.append("Loop present; space depends on whether new collections are allocated.")

    return ComplexityEstimate(
        estimated_time_complexity=time_complexity,
        estimated_auxiliary_space=space_complexity,
        confidence=_confidence(time_complexity, has_recursion),
        reasoning=" ".join(reasoning_parts) if reasoning_parts else "No analyzable patterns found.",
        assumptions=assumptions,
        limitations=(
            "This is a heuristic estimate based on code structure, not formal analysis. "
            "Actual complexity depends on input, algorithm correctness, and runtime behavior. "
            "The AI has not executed or benchmarked this code."
        ),
    )


def _max_loop_depth(tree: ast.AST) -> int:
    """Return the maximum nesting depth of for/while loops in the tree."""
    def _depth(node, current_depth):
        if isinstance(node, (ast.For, ast.While)):
            current_depth += 1
        max_d = current_depth
        for child in ast.iter_child_nodes(node):
            max_d = max(max_d, _depth(child, current_depth))
        return max_d
    return _depth(tree, 0)


def _has_recursion(tree: ast.AST) -> bool:
    """Detect any function that calls itself by name."""
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_name = node.name
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    if isinstance(child.func, ast.Name) and child.func.id == func_name:
                        return True
    return False


def _has_sort_call(tree: ast.AST) -> bool:
    sort_names = {"sort", "sorted", "heapify", "heappush", "heappop"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in sort_names:
                return True
            if isinstance(node.func, ast.Attribute) and node.func.attr in sort_names:
                return True
    return False


def _has_logarithmic_pattern(tree: ast.AST) -> bool:
    """Detect patterns like n //= 2 or n >>= 1 inside loops."""
    for node in ast.walk(tree):
        if isinstance(node, ast.AugAssign):
            if isinstance(node.op, (ast.FloorDiv, ast.RShift)):
                return True
    return False


def _has_dict_set_ops(tree: ast.AST) -> bool:
    collection_names = {"dict", "set", "defaultdict", "Counter", "OrderedDict"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in collection_names:
                return True
        if isinstance(node, (ast.Dict, ast.Set)):
            return True
    return False


def _confidence(complexity: str, has_recursion: bool) -> str:
    if has_recursion or complexity == UNKNOWN:
        return "low"
    if complexity in ("O(1)", "O(n)", "O(n log n)", "O(n²)"):
        return "medium"
    return "low"


def _c_complexity(source_code: str) -> ComplexityEstimate:
    """Conservative complexity estimate for C using pattern matching."""
    lines = source_code.splitlines()
    loop_depth = 0
    max_depth = 0
    has_recursive_pattern = False
    assumptions: List[str] = []
    reasoning_parts: List[str] = []

    # Simple brace-counting approach for loop nesting
    in_loop_stack: List[int] = []
    brace_depth = 0
    for line in lines:
        stripped = line.strip()
        if re.search(r'\bfor\s*\(', stripped) or re.search(r'\bwhile\s*\(', stripped):
            in_loop_stack.append(brace_depth)
            loop_depth = len(in_loop_stack)
            max_depth = max(max_depth, loop_depth)
        brace_depth += stripped.count("{") - stripped.count("}")
        in_loop_stack = [d for d in in_loop_stack if d < brace_depth]
        loop_depth = len(in_loop_stack)

    # Check for recursive function call (same name called inside function)
    func_matches = re.findall(r'\b(\w+)\s*\(', source_code)
    # Simple heuristic: if same identifier appears in function def and call
    func_def = re.findall(r'\b\w+\s+(\w+)\s*\([^)]*\)\s*\{', source_code)
    for name in func_def:
        occurrences = [m for m in func_matches if m == name]
        if len(occurrences) > 1:
            has_recursive_pattern = True
            break

    if has_recursive_pattern:
        time_complexity = UNKNOWN
        space_complexity = UNKNOWN
        reasoning_parts.append("Recursive function calls detected.")
    elif max_depth == 0:
        time_complexity = "O(1)"
        reasoning_parts.append("No loops detected; operations appear constant-time.")
    elif max_depth == 1:
        time_complexity = "O(n)"
        reasoning_parts.append("Single loop depth detected.")
        assumptions.append("Loop iterates over n elements.")
    elif max_depth == 2:
        time_complexity = "O(n²)"
        reasoning_parts.append("Two nested loops detected.")
        assumptions.append("Both loops are proportional to n.")
    else:
        time_complexity = f"O(n^{max_depth})"
        reasoning_parts.append(f"{max_depth} loop levels detected.")

    space_complexity = "O(1)"
    if re.search(r'\bmalloc\s*\(', source_code) or re.search(r'\bcalloc\s*\(', source_code):
        space_complexity = "O(n)"
        reasoning_parts.append("Dynamic memory allocation detected.")

    return ComplexityEstimate(
        estimated_time_complexity=time_complexity,
        estimated_auxiliary_space=space_complexity,
        confidence="low" if has_recursive_pattern or time_complexity == UNKNOWN else "medium",
        reasoning=" ".join(reasoning_parts) or "No recognizable patterns.",
        assumptions=assumptions,
        limitations=(
            "C analysis uses conservative pattern matching, not full AST analysis. "
            "Macro expansion, pointer arithmetic, and indirect calls are not tracked. "
            "This estimate should be treated as indicative only."
        ),
    )


def estimate_complexity(language: str, source_code: str) -> ComplexityEstimate:
    lang = language.lower()
    if lang == "python":
        return _python_complexity(source_code)
    elif lang in ("c", "c++", "cpp"):
        return _c_complexity(source_code)
    else:
        return ComplexityEstimate(
            estimated_time_complexity=UNKNOWN,
            estimated_auxiliary_space=UNKNOWN,
            confidence="low",
            reasoning=f"Complexity estimation is not implemented for '{language}'.",
            assumptions=[],
            limitations="Python and C are currently supported.",
        )
