"""
Comparison / verification service.

Runs both original and candidate code through the execution provider
using identical inputs and compares the results honestly.
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from app.schemas import CompareResponse, VersionResult
from app.services.execution_service import execute_code
from app.services.proof_service import generate_proof_report

logger = logging.getLogger("recodex.compare")


async def compare_versions(
    language: str,
    original_code: str,
    candidate_code: str,
    test_inputs: List[str],
) -> CompareResponse:
    if not test_inputs:
        test_inputs = [""]

    limitations: List[str] = [
        "Comparison uses exact string matching of stdout. "
        "Floating-point output or OS-specific formatting may cause false mismatches.",
        "Memory measurements depend on execution provider support.",
        "The AI has not executed or verified this code; the execution provider has.",
    ]

    # Use first test input for primary comparison
    primary_input = test_inputs[0]

    orig_result, cand_result = await asyncio.gather(
        execute_code(language, original_code, primary_input),
        execute_code(language, candidate_code, primary_input),
    )

    orig_vr = VersionResult(
        status=orig_result.status,
        stdout=orig_result.stdout,
        stderr=orig_result.stderr,
        exit_code=orig_result.exit_code,
        time_seconds=orig_result.time_seconds,
        memory_kb=orig_result.memory_kb,
    )

    cand_vr = VersionResult(
        status=cand_result.status,
        stdout=cand_result.stdout,
        stderr=cand_result.stderr,
        exit_code=cand_result.exit_code,
        time_seconds=cand_result.time_seconds,
        memory_kb=cand_result.memory_kb,
    )

    # Configuration or execution failure
    if orig_result.status in ("configuration_error", "error", "timeout"):
        report = generate_proof_report(
            language=language,
            original_code=original_code,
            candidate_code=candidate_code,
            test_inputs=test_inputs,
            orig_vr=orig_vr,
            cand_vr=cand_vr,
            orig_raw=orig_result,
            cand_raw=cand_result,
            outputs_match=False,
            base_limitations=limitations,
        )
        return CompareResponse(
            correctness_verified=False,
            original=orig_vr,
            candidate=cand_vr,
            outputs_match=False,
            verdict="unverified",
            explanation=f"Comparison incomplete: original execution failed ({orig_result.status}). "
                        f"{orig_result.message or ''}",
            limitations=limitations,
            proof_report=report,
        )

    if cand_result.status in ("configuration_error", "error", "timeout"):
        report = generate_proof_report(
            language=language,
            original_code=original_code,
            candidate_code=candidate_code,
            test_inputs=test_inputs,
            orig_vr=orig_vr,
            cand_vr=cand_vr,
            orig_raw=orig_result,
            cand_raw=cand_result,
            outputs_match=False,
            base_limitations=limitations,
        )
        return CompareResponse(
            correctness_verified=False,
            original=orig_vr,
            candidate=cand_vr,
            outputs_match=False,
            verdict="failed",
            explanation=f"Candidate execution failed ({cand_result.status}). "
                        f"The optimization cannot be verified.",
            limitations=limitations,
            proof_report=report,
        )

    outputs_match = (orig_result.stdout or "").strip() == (cand_result.stdout or "").strip()

    time_delta: Optional[float] = None
    if orig_result.time_seconds is not None and cand_result.time_seconds is not None:
        time_delta = cand_result.time_seconds - orig_result.time_seconds

    mem_delta: Optional[int] = None
    if orig_result.memory_kb is not None and cand_result.memory_kb is not None:
        mem_delta = cand_result.memory_kb - orig_result.memory_kb

    if not outputs_match:
        verdict = "failed"
        explanation = (
            "The candidate produces different output than the original. "
            "The optimization cannot be considered correct."
        )
    elif time_delta is not None:
        if time_delta < -0.01:
            verdict = "improvement"
            explanation = f"Candidate is faster by {abs(time_delta):.3f}s and produces identical output."
        elif time_delta > 0.01:
            verdict = "regression"
            explanation = f"Candidate is slower by {abs(time_delta):.3f}s despite identical output."
        else:
            verdict = "equivalent"
            explanation = "Both versions produce identical output with similar runtime."
    else:
        verdict = "equivalent"
        explanation = "Both versions produce identical output. Runtime data not available from provider."

    report = generate_proof_report(
        language=language,
        original_code=original_code,
        candidate_code=candidate_code,
        test_inputs=test_inputs,
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        orig_raw=orig_result,
        cand_raw=cand_result,
        outputs_match=outputs_match,
        time_delta_seconds=time_delta,
        memory_delta_kb=mem_delta,
        base_limitations=limitations,
    )

    return CompareResponse(
        correctness_verified=outputs_match,
        original=orig_vr,
        candidate=cand_vr,
        outputs_match=outputs_match,
        time_delta_seconds=time_delta,
        memory_delta_kb=mem_delta,
        verdict=verdict,
        explanation=explanation,
        limitations=limitations,
        proof_report=report,
    )
