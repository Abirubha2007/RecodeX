"""ReCodeX – shared Pydantic schemas."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Common ────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None


class SuccessResponse(BaseModel):
    message: str


# ── Languages ─────────────────────────────────────────────────────────────────

class Language(BaseModel):
    id: str           # internal id, e.g. "python"
    name: str
    version: Optional[str] = None
    compiler_id: Optional[str] = None # provider compiler id, e.g. "python-3.14"
    judge0_id: Optional[int] = None   # retained for backward compatibility


class LanguagesResponse(BaseModel):
    languages: List[Language]


# ── Execute ───────────────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    language: str = Field(..., description="Language identifier, e.g. 'python'")
    source_code: str = Field(..., min_length=1)
    stdin: Optional[str] = Field(default="", description="Standard input")


class ExecuteResponse(BaseModel):
    status: str                        # "accepted" | "error" | "timeout" | "compilation_error" | ...
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    exit_code: Optional[int] = None
    time_seconds: Optional[float] = None
    memory_kb: Optional[int] = None
    message: Optional[str] = None


# ── Analyze ───────────────────────────────────────────────────────────────────

class Finding(BaseModel):
    rule_id: str
    title: str
    severity: str           # "info" | "warning" | "error"
    confidence: str         # "high" | "medium" | "low"
    line: Optional[int] = None
    explanation: str
    suggestion: str
    limitations: Optional[str] = None


class ComplexityEstimate(BaseModel):
    estimated_time_complexity: str
    estimated_auxiliary_space: str
    confidence: str
    reasoning: str
    assumptions: List[str] = []
    limitations: str


class AnalyzeRequest(BaseModel):
    language: str
    source_code: str = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    language: str
    findings: List[Finding]
    complexity: ComplexityEstimate
    analysis_source: str = "static"   # "static" | "ai" | "hybrid"


# ── AI ────────────────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    language: str
    source_code: str
    context: Optional[str] = Field(default=None, description="Error output or specific question")
    explain_type: str = Field(
        default="code",
        description="'code' | 'error' | 'complexity' | 'diff'",
    )


class ExplainResponse(BaseModel):
    explanation: str
    suggestions: List[str] = []


class OptimizeRequest(BaseModel):
    language: str
    source_code: str
    context: Optional[str] = None


class OptimizationResult(BaseModel):
    summary: str
    language: str
    optimized_code: str
    changes: List[str]
    rationale: str
    expected_complexity: str
    assumptions: List[str]
    suggested_tests: List[str]
    limitations: str


class OptimizeResponse(BaseModel):
    result: OptimizationResult
    warning: str = (
        "This is an AI-generated candidate. "
        "Verify correctness and performance using the Green Diff tool before accepting."
    )


# ── Compare ───────────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    language: str
    original_code: str
    candidate_code: str
    test_inputs: List[str] = Field(default_factory=list)


class VersionResult(BaseModel):
    status: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    time_seconds: Optional[float] = None
    memory_kb: Optional[int] = None


class SourceSnapshot(BaseModel):
    code: str
    sha256: str
    bytes: int


class ExecutionProviderInfo(BaseModel):
    provider: str
    compiler: str


class VersionExecutionReport(BaseModel):
    status: str
    exit_code: Optional[int] = None
    time_seconds: Optional[float] = None
    memory_kb: Optional[int] = None
    stdout_sample: Optional[str] = None
    stderr_sample: Optional[str] = None


class CorrectnessEvidence(BaseModel):
    status: str       # "verified" | "failed" | "unverified"
    label: str        # e.g. "Verified for tested cases"
    outputs_match: bool
    details: str


class PerformanceEvidence(BaseModel):
    verdict: str      # "improvement" | "regression" | "equivalence" | "insufficient_evidence"
    label: str        # e.g. "Performance Improvement"
    time_delta_seconds: Optional[float] = None
    memory_delta_kb: Optional[int] = None
    details: str


class ProofReport(BaseModel):
    id: str
    timestamp: str
    language: str
    test_inputs: List[str] = []
    source: Dict[str, SourceSnapshot]
    execution_provider: ExecutionProviderInfo
    executions: Dict[str, VersionExecutionReport]
    correctness: CorrectnessEvidence
    performance: PerformanceEvidence
    missing_metrics: List[str] = []
    limitations: List[str] = []
    unresolved_risks: List[str] = []
    secrets_redacted: bool = True


class CompareResponse(BaseModel):
    correctness_verified: bool
    original: VersionResult
    candidate: VersionResult
    outputs_match: bool
    time_delta_seconds: Optional[float] = None
    memory_delta_kb: Optional[int] = None
    verdict: str          # "improvement" | "regression" | "equivalent" | "unverified" | "failed"
    explanation: str
    limitations: List[str] = []
    proof_report: Optional[ProofReport] = None


# ── Benchmark ─────────────────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    language: str
    source_code: str
    inputs: List[str] = Field(..., min_length=1, max_length=10)
    repetitions: int = Field(default=3, ge=1, le=10)


class BenchmarkDataPoint(BaseModel):
    input_label: str
    time_seconds: Optional[float] = None
    memory_kb: Optional[int] = None
    status: str


class BenchmarkResponse(BaseModel):
    results: List[BenchmarkDataPoint]
    summary: str
    limitations: List[str] = []


# ── Green Score ───────────────────────────────────────────────────────────────

class GreenScoreRequest(BaseModel):
    language: str
    source_code: str
    execute_result: Optional[ExecuteResponse] = None
    analyze_result: Optional[AnalyzeResponse] = None


class ComponentScore(BaseModel):
    score: Optional[float] = None   # 0-100, or None if unavailable
    label: str
    explanation: str
    weight: float


class GreenScoreResponse(BaseModel):
    overall_score: Optional[float] = None   # None if insufficient data
    components: Dict[str, ComponentScore]
    available_metrics: List[str]
    findings: List[str]
    score_explanation: str
    confidence: str
    limitations: List[str]
