"""
Proof Report Service for Proof-Carrying Optimization (PCO).

Generates structured, verifiable proof reports from actual code comparison executions.
Reuses existing execution evidence without fabrication or second execution pipelines.
Redacts any API keys or credentials.
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core import config
from app.schemas import (
    CorrectnessEvidence,
    ExecuteResponse,
    ExecutionProviderInfo,
    PerformanceEvidence,
    ProofReport,
    SourceSnapshot,
    VersionExecutionReport,
    VersionResult,
)
from app.services.execution_service import LANGUAGE_MAP

logger = logging.getLogger("recodex.proof")

# Patterns for sensitive tokens that must never be included in exportable reports
_SECRET_PATTERNS = [
    re.compile(r"gsk_[A-Za-z0-9_-]{20,}", re.IGNORECASE),
    re.compile(r"[0-9a-f]{32,64}", re.IGNORECASE),  # general 32/64 hex API keys
    re.compile(r"bearer\s+[A-Za-z0-9_\-\.]{15,}", re.IGNORECASE),
    re.compile(r"api[-_]?key", re.IGNORECASE),
]


def redact_string(val: str) -> str:
    """Redact any known secret tokens or keys from string values."""
    if not val:
        return val

    redacted = val
    settings = config.get_settings()
    for secret in (
        settings.ONLINECOMPILER_API_KEY,
        settings.GROQ_API_KEY,
        settings.DATABASE_URL,
    ):
        if secret and len(secret) >= 6 and secret in redacted:
            redacted = redacted.replace(secret, "[REDACTED_CREDENTIAL]")

    return redacted


def _hash_code(code: str) -> str:
    """Compute standard SHA-256 hash for source code."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_proof_report(
    language: str,
    original_code: str,
    candidate_code: str,
    test_inputs: List[str],
    orig_vr: VersionResult,
    cand_vr: VersionResult,
    orig_raw: Optional[ExecuteResponse] = None,
    cand_raw: Optional[ExecuteResponse] = None,
    outputs_match: bool = False,
    time_delta_seconds: Optional[float] = None,
    memory_delta_kb: Optional[int] = None,
    base_limitations: Optional[List[str]] = None,
) -> ProofReport:
    """
    Construct a complete ProofReport reusing real comparison execution outputs.
    Guarantees correctness status is kept distinct from performance verdict.
    Never marks verified if executions failed, timed out, or evidence is missing.
    """
    settings = config.get_settings()
    report_id = f"proof_{uuid.uuid4().hex[:16]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    clean_inputs = [redact_string(t) for t in (test_inputs or [""])]

    # 1. Source snapshots
    source_info = {
        "original": SourceSnapshot(
            code=redact_string(original_code),
            sha256=_hash_code(original_code),
            bytes=len(original_code.encode("utf-8")),
        ),
        "candidate": SourceSnapshot(
            code=redact_string(candidate_code),
            sha256=_hash_code(candidate_code),
            bytes=len(candidate_code.encode("utf-8")),
        ),
    }

    # 2. Execution provider info (identity only, never secrets)
    provider_info = ExecutionProviderInfo(
        provider=settings.EXECUTION_PROVIDER or "onlinecompiler",
        compiler=LANGUAGE_MAP.get(language.lower(), language),
    )

    # 3. Executions per version
    orig_status = orig_vr.status or "unknown"
    cand_status = cand_vr.status or "unknown"

    exec_reports = {
        "original": VersionExecutionReport(
            status=orig_status,
            exit_code=orig_vr.exit_code,
            time_seconds=orig_vr.time_seconds,
            memory_kb=orig_vr.memory_kb,
            stdout_sample=redact_string((orig_vr.stdout or "")[:1000]) if orig_vr.stdout is not None else None,
            stderr_sample=redact_string((orig_vr.stderr or "")[:1000]) if orig_vr.stderr is not None else None,
        ),
        "candidate": VersionExecutionReport(
            status=cand_status,
            exit_code=cand_vr.exit_code,
            time_seconds=cand_vr.time_seconds,
            memory_kb=cand_vr.memory_kb,
            stdout_sample=redact_string((cand_vr.stdout or "")[:1000]) if cand_vr.stdout is not None else None,
            stderr_sample=redact_string((cand_vr.stderr or "")[:1000]) if cand_vr.stderr is not None else None,
        ),
    }

    # 4. Correctness status evaluation (strictly separated from performance)
    is_orig_ok = orig_status == "accepted" and orig_vr.exit_code == 0
    is_cand_ok = cand_status == "accepted" and cand_vr.exit_code == 0

    if not is_orig_ok:
        correctness_status = "unverified"
        correctness_label = f"Unverified (original execution {orig_status})"
        correctness_details = (
            f"Original code execution did not complete successfully (status: {orig_status}). "
            f"Equivalence cannot be established."
        )
    elif not is_cand_ok:
        correctness_status = "failed"
        correctness_label = f"Failed (candidate execution {cand_status})"
        correctness_details = (
            f"Candidate code execution encountered an error (status: {cand_status}, "
            f"exit code: {cand_vr.exit_code}). The candidate is not a verified replacement."
        )
    elif not outputs_match:
        correctness_status = "failed"
        correctness_label = "Failed (output mismatch)"
        correctness_details = (
            "The candidate produced different stdout output from the original code "
            "for the tested inputs."
        )
    else:
        correctness_status = "verified"
        correctness_label = "Verified for tested cases"
        correctness_details = (
            "Candidate executed successfully and produced output identical to the "
            "original code across all tested inputs."
        )

    correctness_evidence = CorrectnessEvidence(
        status=correctness_status,
        label=correctness_label,
        outputs_match=outputs_match,
        details=correctness_details,
    )

    # 5. Performance evaluation (explicitly distinct from correctness)
    if correctness_status != "verified":
        perf_verdict = "insufficient_evidence"
        perf_label = "Insufficient Evidence"
        perf_details = "Performance evaluation withheld because functional correctness is not verified."
    elif orig_vr.time_seconds is None or cand_vr.time_seconds is None:
        perf_verdict = "insufficient_evidence"
        perf_label = "Insufficient Evidence"
        perf_details = "Execution runtime duration was not provided by the execution environment."
    elif time_delta_seconds is not None:
        if time_delta_seconds < -0.01:
            perf_verdict = "improvement"
            perf_label = "Performance Improvement"
            perf_details = f"Candidate is faster by {abs(time_delta_seconds):.3f}s with matching output."
        elif time_delta_seconds > 0.01:
            perf_verdict = "regression"
            perf_label = "Performance Regression"
            perf_details = f"Candidate is slower by {abs(time_delta_seconds):.3f}s despite matching output."
        else:
            perf_verdict = "equivalence"
            perf_label = "Performance Equivalence"
            perf_details = f"Both versions demonstrated equivalent execution speed (delta: {time_delta_seconds:+.3f}s)."
    else:
        perf_verdict = "equivalence"
        perf_label = "Performance Equivalence"
        perf_details = "Both versions produced identical outputs with comparable runtime."

    performance_evidence = PerformanceEvidence(
        verdict=perf_verdict,
        label=perf_label,
        time_delta_seconds=time_delta_seconds,
        memory_delta_kb=memory_delta_kb,
        details=perf_details,
    )

    # 6. Missing metrics list
    missing_metrics: List[str] = []
    if orig_vr.time_seconds is None or cand_vr.time_seconds is None:
        missing_metrics.append("Runtime duration metric unavailable from execution provider.")
    if orig_vr.memory_kb is None or cand_vr.memory_kb is None:
        missing_metrics.append("Memory consumption metric unavailable from execution provider.")
    if not test_inputs or test_inputs == [""]:
        missing_metrics.append("No custom stdin inputs provided; comparison relied solely on default empty stdin.")

    # 7. Limitations & Unresolved risks
    limitations: List[str] = list(base_limitations or [
        "Comparison uses exact string matching of stdout. Floating-point formatting, trailing spaces, or OS line endings may trigger false mismatches.",
        "Resource metrics reflect a single-run remote execution sandbox; network latency and multi-tenant host load may introduce variance.",
    ])

    unresolved_risks: List[str] = [
        "Verification is bounded strictly to the tested input set; this report does not constitute a formal mathematical proof for all arbitrary unbounded inputs.",
        "Corner cases, recursion limits, memory exhaustion under heavy load, and integer overflows remain unverified unless included in test inputs.",
        "Non-deterministic, multi-threaded, or asynchronous I/O behavior cannot be guaranteed identical across all external runtimes.",
    ]

    return ProofReport(
        id=report_id,
        timestamp=now_iso,
        language=language,
        test_inputs=clean_inputs,
        source=source_info,
        execution_provider=provider_info,
        executions=exec_reports,
        correctness=correctness_evidence,
        performance=performance_evidence,
        missing_metrics=missing_metrics,
        limitations=limitations,
        unresolved_risks=unresolved_risks,
        secrets_redacted=True,
    )


def export_proof_report_html(report: ProofReport) -> str:
    """
    Generate a clean, standalone, self-contained HTML proof report document.
    Formatted for both screen viewing and printing / PDF export.
    Zero external runtime dependencies.
    """
    r_id = html.escape(report.id)
    r_ts = html.escape(report.timestamp)
    r_lang = html.escape(report.language)
    r_prov = html.escape(report.execution_provider.provider)
    r_comp = html.escape(report.execution_provider.compiler)

    # Color tokens based on correctness
    c_status = report.correctness.status
    if c_status == "verified":
        c_badge_bg = "#ecfdf5"
        c_badge_color = "#047857"
        c_border = "#a7f3d0"
    elif c_status == "failed":
        c_badge_bg = "#fef2f2"
        c_badge_color = "#b91c1c"
        c_border = "#fecaca"
    else:
        c_badge_bg = "#f3f4f6"
        c_badge_color = "#4b5563"
        c_border = "#e5e7eb"

    # Color tokens based on performance
    p_verdict = report.performance.verdict
    if p_verdict == "improvement":
        p_badge_bg = "#ecfdf5"
        p_badge_color = "#047857"
    elif p_verdict == "regression":
        p_badge_bg = "#fffbeb"
        p_badge_color = "#b45309"
    elif p_verdict == "equivalence":
        p_badge_bg = "#eff6ff"
        p_badge_color = "#1d4ed8"
    else:
        p_badge_bg = "#f3f4f6"
        p_badge_color = "#6b7280"

    orig_exec = report.executions["original"]
    cand_exec = report.executions["candidate"]

    orig_time_str = f"{orig_exec.time_seconds:.3f}s" if orig_exec.time_seconds is not None else "N/A"
    cand_time_str = f"{cand_exec.time_seconds:.3f}s" if cand_exec.time_seconds is not None else "N/A"
    orig_mem_str = f"{orig_exec.memory_kb} KB" if orig_exec.memory_kb is not None else "N/A"
    cand_mem_str = f"{cand_exec.memory_kb} KB" if cand_exec.memory_kb is not None else "N/A"

    delta_time_str = (
        f"{report.performance.time_delta_seconds:+.3f}s"
        if report.performance.time_delta_seconds is not None
        else "N/A"
    )
    delta_mem_str = (
        f"{report.performance.memory_delta_kb:+d} KB"
        if report.performance.memory_delta_kb is not None
        else "N/A"
    )

    missing_html = "".join(f"<li>{html.escape(m)}</li>" for m in report.missing_metrics) or "<li>None</li>"
    risks_html = "".join(f"<li>{html.escape(r)}</li>" for r in report.unresolved_risks)
    limits_html = "".join(f"<li>{html.escape(l)}</li>" for l in report.limitations)

    orig_sha = html.escape(report.source["original"].sha256)
    cand_sha = html.escape(report.source["candidate"].sha256)

    orig_code_esc = html.escape(report.source["original"].code)
    cand_code_esc = html.escape(report.source["candidate"].code)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ReCodeX Proof Report – {r_id}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 40px;
      color: #1f2937;
      background: #fafafa;
      line-height: 1.5;
    }}
    .container {{
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px 40px;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: 1px solid #e5e7eb;
    }}
    header {{
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }}
    .card {{
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 0.875rem;
    }}
    th, td {{
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }}
    th {{
      background: #f3f4f6;
      font-weight: 600;
    }}
    pre {{
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 0.8125rem;
      overflow-x: auto;
      max-height: 280px;
    }}
    .code-hash {{
      font-family: monospace;
      font-size: 0.75rem;
      color: #6b7280;
      word-break: break-all;
    }}
    @media print {{
      body {{ background: #fff; margin: 0; }}
      .container {{ box-shadow: none; border: none; padding: 0; max-width: 100%; }}
      pre {{ max-height: none; page-break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <h1 style="margin: 0; font-size: 1.5rem; color: #111827;">ReCodeX Proof-Carrying Optimization Report</h1>
        <span style="font-size: 0.875rem; color: #6b7280;">ID: {r_id}</span>
      </div>
      <div style="margin-top: 8px; font-size: 0.8125rem; color: #6b7280;">
        Timestamp: {r_ts} &bull; Language: <strong>{r_lang}</strong> &bull; Provider: <strong>{r_prov} ({r_comp})</strong>
      </div>
    </header>

    <!-- Correctness & Performance Summary -->
    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
      <div style="flex: 1; padding: 16px; border-radius: 8px; background: {c_badge_bg}; border: 1px solid {c_border};">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #6b7280;">Correctness Status</div>
        <div style="font-size: 1.125rem; font-weight: 700; color: {c_badge_color}; margin-top: 4px;">{html.escape(report.correctness.label)}</div>
        <p style="font-size: 0.8125rem; margin: 6px 0 0 0; color: #374151;">{html.escape(report.correctness.details)}</p>
      </div>

      <div style="flex: 1; padding: 16px; border-radius: 8px; background: {p_badge_bg}; border: 1px solid #e5e7eb;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #6b7280;">Performance Verdict</div>
        <div style="font-size: 1.125rem; font-weight: 700; color: {p_badge_color}; margin-top: 4px;">{html.escape(report.performance.label)}</div>
        <p style="font-size: 0.8125rem; margin: 6px 0 0 0; color: #374151;">{html.escape(report.performance.details)}</p>
      </div>
    </div>

    <!-- Execution Outcomes Table -->
    <div class="card">
      <h3 style="margin-top: 0; font-size: 1rem;">Execution Outcomes</h3>
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Exit Code</th>
            <th>Runtime</th>
            <th>Memory</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Original</strong></td>
            <td>{html.escape(orig_exec.status)}</td>
            <td>{orig_exec.exit_code if orig_exec.exit_code is not None else "N/A"}</td>
            <td>{orig_time_str}</td>
            <td>{orig_mem_str}</td>
          </tr>
          <tr>
            <td><strong>Candidate</strong></td>
            <td>{html.escape(cand_exec.status)}</td>
            <td>{cand_exec.exit_code if cand_exec.exit_code is not None else "N/A"}</td>
            <td>{cand_time_str}</td>
            <td>{cand_mem_str}</td>
          </tr>
          <tr style="font-weight: 600; background: #fafafa;">
            <td><strong>Delta</strong></td>
            <td>{ "Outputs Match" if report.correctness.outputs_match else "Outputs Differ" }</td>
            <td>-</td>
            <td>{delta_time_str}</td>
            <td>{delta_mem_str}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Source Snapshots & Hashes -->
    <div class="card">
      <h3 style="margin-top: 0; font-size: 1rem;">Cryptographic Source Proof</h3>
      <div style="margin-bottom: 12px;">
        <div><strong>Original SHA-256:</strong> <span class="code-hash">{orig_sha}</span></div>
        <div><strong>Candidate SHA-256:</strong> <span class="code-hash">{cand_sha}</span></div>
      </div>
      <div style="display: flex; gap: 16px;">
        <div style="flex: 1;">
          <h4 style="margin: 4px 0; font-size: 0.875rem;">Original Source</h4>
          <pre><code>{orig_code_esc}</code></pre>
        </div>
        <div style="flex: 1;">
          <h4 style="margin: 4px 0; font-size: 0.875rem;">Candidate Source</h4>
          <pre><code>{cand_code_esc}</code></pre>
        </div>
      </div>
    </div>

    <!-- Evidence Limitations, Missing Metrics, and Unresolved Risks -->
    <div class="card">
      <h3 style="margin-top: 0; font-size: 1rem;">Evidence Qualification & Governance</h3>
      
      <h4 style="margin: 8px 0 4px 0; font-size: 0.875rem; color: #b45309;">Missing Metrics</h4>
      <ul style="font-size: 0.8125rem; margin: 4px 0; padding-left: 20px;">
        {missing_html}
      </ul>

      <h4 style="margin: 12px 0 4px 0; font-size: 0.875rem; color: #4b5563;">Limitations</h4>
      <ul style="font-size: 0.8125rem; margin: 4px 0; padding-left: 20px;">
        {limits_html}
      </ul>

      <h4 style="margin: 12px 0 4px 0; font-size: 0.875rem; color: #b91c1c;">Unresolved Risks</h4>
      <ul style="font-size: 0.8125rem; margin: 4px 0; padding-left: 20px;">
        {risks_html}
      </ul>
    </div>

    <footer style="text-align: center; font-size: 0.75rem; color: #9ca3af; margin-top: 24px;">
      Generated by ReCodeX Proof-Carrying Optimization Service &bull; Secrets Redacted: True
    </footer>
  </div>
</body>
</html>"""
