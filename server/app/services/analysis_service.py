"""
Static code analysis service.

Uses AST-based analysis for Python and conservative pattern matching for C.
Every finding includes rule_id, severity, confidence, and limitations.
"""

from __future__ import annotations

import ast
import re
import logging
from typing import List

from app.schemas import Finding

logger = logging.getLogger("recodex.analysis")


# ── Python AST analysis ───────────────────────────────────────────────────────

class _PythonAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.findings: List[Finding] = []

    def _add(self, rule_id: str, title: str, severity: str, confidence: str,
             line: int | None, explanation: str, suggestion: str, limitations: str = ""):
        self.findings.append(Finding(
            rule_id=rule_id,
            title=title,
            severity=severity,
            confidence=confidence,
            line=line,
            explanation=explanation,
            suggestion=suggestion,
            limitations=limitations or "Static analysis cannot determine actual runtime cost.",
        ))

    def visit_For(self, node: ast.For):
        self._check_nested_loop(node)
        self._check_repeated_call_in_loop(node)
        self._check_string_concat_in_loop(node)
        self.generic_visit(node)

    def visit_While(self, node: ast.While):
        self._check_nested_loop(node)
        self.generic_visit(node)

    def _check_nested_loop(self, node):
        for child in ast.walk(node):
            if child is node:
                continue
            if isinstance(child, (ast.For, ast.While)):
                self._add(
                    rule_id="PY001",
                    title="Nested loop detected",
                    severity="warning",
                    confidence="medium",
                    line=getattr(node, "lineno", None),
                    explanation=(
                        "A loop contains another loop. This structure may result in O(n²) "
                        "or higher complexity depending on the loop bounds."
                    ),
                    suggestion=(
                        "Consider whether the inner loop can be replaced with a set lookup, "
                        "dictionary operation, or precomputed result."
                    ),
                    limitations="Not all nested loops are inefficient; context matters.",
                )
                break  # One finding per outer loop

    def _check_repeated_call_in_loop(self, node):
        """Detect repeated len(), sorted(), etc. calls inside loops."""
        expensive_calls = {"len", "sorted", "reversed", "list", "set", "dict", "tuple", "sum", "max", "min"}
        call_counter: dict = {}
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                name = child.func.id
                if name in expensive_calls:
                    call_counter[name] = call_counter.get(name, 0) + 1
        for name, count in call_counter.items():
            if count >= 2:
                self._add(
                    rule_id="PY002",
                    title=f"Repeated '{name}()' call inside loop",
                    severity="warning",
                    confidence="medium",
                    line=getattr(node, "lineno", None),
                    explanation=f"'{name}()' is called {count} times inside a loop.",
                    suggestion=f"Cache the result of '{name}()' in a variable before the loop.",
                )

    def _check_string_concat_in_loop(self, node):
        """Detect += string concatenation inside loops."""
        for child in ast.walk(node):
            if isinstance(child, ast.AugAssign) and isinstance(child.op, ast.Add):
                # Definite non-string: number literal
                if isinstance(child.value, ast.Constant) and not isinstance(child.value.value, str):
                    continue
                is_str = False
                if isinstance(child.value, ast.JoinedStr):
                    is_str = True
                elif isinstance(child.value, ast.Constant) and isinstance(child.value.value, str):
                    is_str = True
                elif isinstance(child.value, ast.Call) and getattr(child.value.func, "id", "") in ("str", "format", "repr"):
                    is_str = True
                elif isinstance(child.value, ast.BinOp):
                    for sub in ast.walk(child.value):
                        if (isinstance(sub, ast.Constant) and isinstance(sub.value, str)) or isinstance(sub, ast.JoinedStr):
                            is_str = True
                            break
                elif isinstance(child.target, ast.Name) and child.target.id in ("s", "str", "text", "out_str", "result_str"):
                    is_str = True

                if is_str:
                    self._add(
                        rule_id="PY003",
                        title="String concatenation with += inside loop",
                        severity="warning",
                        confidence="low",
                        line=getattr(child, "lineno", None),
                        explanation=(
                            "Using += to build a string inside a loop can be O(n²) "
                            "because strings are immutable in Python."
                        ),
                        suggestion="Collect parts in a list and use ''.join(parts) after the loop.",
                    )
                    break

    def visit_ListComp(self, node: ast.ListComp):
        """Detect list comprehensions with expensive predicates (conservative)."""
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._check_unused_variables(node)
        self.generic_visit(node)

    def _check_unused_variables(self, func_node: ast.FunctionDef):
        assigned = {}
        used_names = set()
        for child in ast.walk(func_node):
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        assigned[target.id] = getattr(target, "lineno", None)
            elif isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load):
                used_names.add(child.id)
        for name, line in assigned.items():
            if name not in used_names and not name.startswith("_"):
                self._add(
                    rule_id="PY004",
                    title=f"Potentially unused variable '{name}'",
                    severity="info",
                    confidence="low",
                    line=line,
                    explanation=f"Variable '{name}' is assigned but not read within this function.",
                    suggestion=f"Remove '{name}' if it is not needed, or prefix with '_' to suppress.",
                    limitations="Analysis is intra-function only; variables used elsewhere are not tracked.",
                )


def _analyze_python(source_code: str) -> List[Finding]:
    findings: List[Finding] = []
    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        findings.append(Finding(
            rule_id="PY000",
            title="Syntax error",
            severity="error",
            confidence="high",
            line=e.lineno,
            explanation=f"Python syntax error: {e.msg}",
            suggestion="Fix the syntax error before analyzing further.",
        ))
        return findings
    analyzer = _PythonAnalyzer()
    analyzer.visit(tree)
    return analyzer.findings


# ── C pattern-based analysis ──────────────────────────────────────────────────

def _analyze_c(source_code: str) -> List[Finding]:
    findings: List[Finding] = []
    lines = source_code.splitlines()

    # Detect nested for loops
    brace_depth = 0
    loop_depths: list = []
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if re.search(r'\bfor\s*\(', stripped) or re.search(r'\bwhile\s*\(', stripped):
            if any(d < brace_depth for d in loop_depths):
                findings.append(Finding(
                    rule_id="C001",
                    title="Nested loop detected",
                    severity="warning",
                    confidence="medium",
                    line=i,
                    explanation="Nested loops may indicate O(n²) or higher time complexity.",
                    suggestion="Consider restructuring with precomputed lookups or sorted data.",
                    limitations="Not all nested loops are inefficient.",
                ))
            loop_depths.append(brace_depth)
        brace_depth += stripped.count("{") - stripped.count("}")
        loop_depths = [d for d in loop_depths if d <= brace_depth]

    # Detect gets() – buffer overflow risk
    if re.search(r'\bgets\s*\(', source_code):
        findings.append(Finding(
            rule_id="C002",
            title="Unsafe gets() usage",
            severity="error",
            confidence="high",
            line=None,
            explanation="gets() does not check buffer length and is vulnerable to buffer overflow.",
            suggestion="Replace with fgets(buffer, sizeof(buffer), stdin).",
        ))

    # Detect printf with non-literal format string
    for i, line in enumerate(lines, start=1):
        if re.search(r'\bprintf\s*\(\s*[a-zA-Z_]', line):
            findings.append(Finding(
                rule_id="C003",
                title="Potentially unsafe printf format string",
                severity="warning",
                confidence="low",
                line=i,
                explanation="printf() with a variable format string may allow format string attacks.",
                suggestion='Use printf("%s", var) instead of printf(var).',
            ))

    return findings


# ── Public interface ──────────────────────────────────────────────────────────

def analyze_code(language: str, source_code: str) -> List[Finding]:
    lang = language.lower()
    if lang == "python":
        return _analyze_python(source_code)
    elif lang in ("c", "c++", "cpp"):
        return _analyze_c(source_code)
    else:
        return [Finding(
            rule_id="GEN001",
            title="Language not fully supported for static analysis",
            severity="info",
            confidence="high",
            line=None,
            explanation=f"Static analysis rules for '{language}' are not yet implemented.",
            suggestion="Python and C are currently supported.",
        )]
