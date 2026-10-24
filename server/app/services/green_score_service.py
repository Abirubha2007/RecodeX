"""
Green Score service.

Computes an explainable 0-100 score from available metrics.
Never fabricates values for missing data.

Weights (initial design choices, not industry standard):
  Algorithmic Efficiency  35%
  Memory Efficiency       25%
  Runtime Performance     25%
  Static Code Quality     15%
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from app.schemas import (
    AnalyzeResponse,
    ComponentScore,
    ExecuteResponse,
    GreenScoreResponse,
)

logger = logging.getLogger("recodex.green_score")

WEIGHTS = {
    "algorithmic_efficiency": 0.35,
    "memory_efficiency": 0.25,
    "runtime_performance": 0.25,
    "static_code_quality": 0.15,
}

# Time complexity → efficiency score (0-100)
COMPLEXITY_SCORES: Dict[str, float] = {
    "O(1)": 100,
    "O(log n)": 90,
    "O(n)": 75,
    "O(n log n)": 60,
    "O(n²)": 35,
    "O(n^2)": 35,
    "O(n^3)": 15,
    "O(2^n)": 5,
    "Unknown": None,
}

# Severity → quality penalty per finding
SEVERITY_PENALTY: Dict[str, float] = {
    "error": 20,
    "warning": 8,
    "info": 2,
}


def _complexity_score(complexity_str: str) -> Optional[float]:
    for key, score in COMPLEXITY_SCORES.items():
        if complexity_str.startswith(key):
            return score
    return None


def _quality_score(analyze_result: Optional[AnalyzeResponse]) -> Optional[float]:
    if analyze_result is None:
        return None
    penalty = sum(
        SEVERITY_PENALTY.get(f.severity, 0) for f in analyze_result.findings
    )
    return max(0.0, 100.0 - penalty)


def _runtime_score(execute_result: Optional[ExecuteResponse]) -> Optional[float]:
    """Score runtime: < 0.1s → 100, 1s → 50, > 5s → 0 (log scale)."""
    if execute_result is None:
        return None
    if execute_result.time_seconds is None:
        return None
    t = execute_result.time_seconds
    if t <= 0:
        return 100.0
    if t < 0.01:
        return 100.0
    if t > 5.0:
        return 0.0
    # Simple linear map 0.01–5.0 → 100–0
    return max(0.0, 100.0 - (t / 5.0) * 100.0)


def _memory_score(execute_result: Optional[ExecuteResponse]) -> Optional[float]:
    """Score memory: < 1000 KB → 100, 100000 KB → 0 (linear)."""
    if execute_result is None:
        return None
    if execute_result.memory_kb is None:
        return None
    m = execute_result.memory_kb
    if m <= 0:
        return 100.0
    return max(0.0, 100.0 - (m / 100000.0) * 100.0)


def calculate_green_score(
    language: str,
    source_code: str,
    execute_result: Optional[ExecuteResponse] = None,
    analyze_result: Optional[AnalyzeResponse] = None,
) -> GreenScoreResponse:
    available_metrics: List[str] = []
    findings_list: List[str] = []
    limitations: List[str] = []

    # ── Component computation ─────────────────────────────────────────────────
    algo_score: Optional[float] = None
    if analyze_result and analyze_result.complexity:
        algo_score = _complexity_score(analyze_result.complexity.estimated_time_complexity)
        if algo_score is not None:
            available_metrics.append("algorithmic_efficiency")
        else:
            limitations.append("Algorithmic efficiency score unavailable: complexity is Unknown.")

    memory_score: Optional[float] = _memory_score(execute_result)
    if memory_score is not None:
        available_metrics.append("memory_efficiency")
    else:
        limitations.append("Memory score unavailable: no execution memory measurement.")

    runtime_score: Optional[float] = _runtime_score(execute_result)
    if runtime_score is not None:
        available_metrics.append("runtime_performance")
    else:
        limitations.append("Runtime score unavailable: no execution time measurement.")

    quality_score: Optional[float] = _quality_score(analyze_result)
    if quality_score is not None:
        available_metrics.append("static_code_quality")
    if analyze_result:
        for f in analyze_result.findings:
            findings_list.append(f"[{f.severity.upper()}] {f.title} (line {f.line})")

    # ── Weighted aggregate ────────────────────────────────────────────────────
    scores = {
        "algorithmic_efficiency": algo_score,
        "memory_efficiency": memory_score,
        "runtime_performance": runtime_score,
        "static_code_quality": quality_score,
    }

    available = {k: v for k, v in scores.items() if v is not None}
    if len(available) < 2:
        overall_score = None
        confidence = "low"
        limitations.append(
            "Insufficient data to compute a reliable overall score. "
            "Run code and analyze it to enable more components."
        )
    else:
        total_weight = sum(WEIGHTS[k] for k in available)
        weighted_sum = sum(WEIGHTS[k] * v for k, v in available.items())
        overall_score = round(weighted_sum / total_weight, 1)
        confidence = "high" if len(available) == 4 else "medium"

    # ── Build component details ───────────────────────────────────────────────
    components: Dict[str, ComponentScore] = {}

    def _comp(key: str, label: str, score: Optional[float], explanation: str) -> ComponentScore:
        return ComponentScore(
            score=round(score, 1) if score is not None else None,
            label=label,
            explanation=explanation,
            weight=WEIGHTS[key],
        )

    components["algorithmic_efficiency"] = _comp(
        "algorithmic_efficiency",
        "Algorithmic Efficiency",
        algo_score,
        f"Based on estimated time complexity: "
        f"{analyze_result.complexity.estimated_time_complexity if analyze_result else 'N/A'}.",
    )
    components["memory_efficiency"] = _comp(
        "memory_efficiency",
        "Memory Efficiency",
        memory_score,
        f"Based on measured memory usage: "
        f"{execute_result.memory_kb if execute_result else 'N/A'} KB.",
    )
    components["runtime_performance"] = _comp(
        "runtime_performance",
        "Runtime Performance",
        runtime_score,
        f"Based on measured execution time: "
        f"{execute_result.time_seconds if execute_result else 'N/A'}s.",
    )
    components["static_code_quality"] = _comp(
        "static_code_quality",
        "Static Code Quality",
        quality_score,
        f"Based on {len(analyze_result.findings) if analyze_result else 0} static analysis findings.",
    )

    limitations += [
        "Green Score weights are initial design choices and not an industry-recognized standard.",
        "Score does not imply carbon reduction without actual energy measurement.",
        "Scores are only comparable when using the same execution environment.",
    ]

    score_explanation = (
        f"Overall score is computed from {len(available)} of 4 components using documented weights "
        f"(Algorithmic 35%, Memory 25%, Runtime 25%, Quality 15%). "
        f"{'Score is None because fewer than 2 components have data.' if overall_score is None else ''}"
    ).strip()

    return GreenScoreResponse(
        overall_score=overall_score,
        components=components,
        available_metrics=available_metrics,
        findings=findings_list,
        score_explanation=score_explanation,
        confidence=confidence,
        limitations=limitations,
    )
