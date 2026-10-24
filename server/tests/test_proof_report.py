"""
Tests for Proof Report generation, validation, export, and secret redaction.
"""

from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.schemas import ExecuteResponse, VersionResult, ProofReport
from app.services.proof_service import generate_proof_report, export_proof_report_html, redact_string

client = TestClient(app)


def test_generate_proof_report_structure():
    """Verify all required fields exist and source hashes are correct SHA-256."""
    orig_code = "print('hello original')"
    cand_code = "print('hello candidate')"
    orig_vr = VersionResult(status="accepted", stdout="hello original\n", exit_code=0, time_seconds=0.03, memory_kb=12000)
    cand_vr = VersionResult(status="accepted", stdout="hello candidate\n", exit_code=0, time_seconds=0.02, memory_kb=11000)

    report = generate_proof_report(
        language="python",
        original_code=orig_code,
        candidate_code=cand_code,
        test_inputs=["sample_in"],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=False,
        time_delta_seconds=-0.01,
        memory_delta_kb=-1000,
    )

    assert report.id.startswith("proof_")
    assert report.timestamp is not None
    assert report.language == "python"
    assert report.test_inputs == ["sample_in"]
    assert "original" in report.source
    assert "candidate" in report.source
    assert len(report.source["original"].sha256) == 64
    assert len(report.source["candidate"].sha256) == 64
    assert report.execution_provider.provider is not None
    assert report.executions["original"].status == "accepted"
    assert report.executions["candidate"].status == "accepted"
    assert report.correctness.status == "failed"  # outputs_match is False
    assert report.performance.verdict == "insufficient_evidence"
    assert report.secrets_redacted is True


def test_correctness_verified_and_performance_verdict_separated():
    """Verify verified correctness is distinguished from performance improvement."""
    orig_code = "print(42)"
    cand_code = "print(42)"
    orig_vr = VersionResult(status="accepted", stdout="42\n", exit_code=0, time_seconds=0.05, memory_kb=15000)
    cand_vr = VersionResult(status="accepted", stdout="42\n", exit_code=0, time_seconds=0.02, memory_kb=13000)

    report = generate_proof_report(
        language="python",
        original_code=orig_code,
        candidate_code=cand_code,
        test_inputs=[],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=True,
        time_delta_seconds=-0.03,
        memory_delta_kb=-2000,
    )

    assert report.correctness.status == "verified"
    assert "Verified for tested cases" in report.correctness.label
    assert report.correctness.outputs_match is True
    assert report.performance.verdict == "improvement"
    assert "Improvement" in report.performance.label
    assert report.performance.time_delta_seconds == -0.03


def test_correctness_failed_on_output_mismatch():
    """Outputs differing must mark correctness failed and performance insufficient_evidence."""
    orig_vr = VersionResult(status="accepted", stdout="1\n", exit_code=0, time_seconds=0.04)
    cand_vr = VersionResult(status="accepted", stdout="2\n", exit_code=0, time_seconds=0.01)

    report = generate_proof_report(
        language="python",
        original_code="print(1)",
        candidate_code="print(2)",
        test_inputs=[],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=False,
        time_delta_seconds=-0.03,
    )

    assert report.correctness.status == "failed"
    assert "output mismatch" in report.correctness.label.lower()
    assert report.performance.verdict == "insufficient_evidence"


def test_execution_failure_or_timeout_never_verified():
    """Candidate or original failure/timeout must never be marked verified."""
    orig_vr = VersionResult(status="accepted", stdout="ok\n", exit_code=0)
    cand_vr = VersionResult(status="timeout", stderr="Timed out after 5s", exit_code=None)

    report = generate_proof_report(
        language="python",
        original_code="print('ok')",
        candidate_code="while True: pass",
        test_inputs=[],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=False,
    )

    assert report.correctness.status == "failed"
    assert "Failed" in report.correctness.label
    assert report.performance.verdict == "insufficient_evidence"

    # Original failure
    orig_fail_vr = VersionResult(status="configuration_error", stderr="Provider down")
    cand_ok_vr = VersionResult(status="accepted", stdout="ok\n", exit_code=0)
    report2 = generate_proof_report(
        language="python",
        original_code="print('ok')",
        candidate_code="print('ok')",
        test_inputs=[],
        orig_vr=orig_fail_vr,
        cand_vr=cand_ok_vr,
        outputs_match=False,
    )
    assert report2.correctness.status == "unverified"
    assert "Unverified" in report2.correctness.label


def test_missing_metrics_handling():
    """Verify missing runtime or memory is tracked in missing_metrics and labels insufficient evidence."""
    orig_vr = VersionResult(status="accepted", stdout="same\n", exit_code=0, time_seconds=None, memory_kb=None)
    cand_vr = VersionResult(status="accepted", stdout="same\n", exit_code=0, time_seconds=None, memory_kb=None)

    report = generate_proof_report(
        language="python",
        original_code="print('same')",
        candidate_code="print('same')",
        test_inputs=[],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=True,
        time_delta_seconds=None,
        memory_delta_kb=None,
    )

    assert report.correctness.status == "verified"
    assert report.performance.verdict == "insufficient_evidence"
    assert any("Runtime" in m for m in report.missing_metrics)
    assert any("Memory" in m for m in report.missing_metrics)
    assert any("stdin" in m for m in report.missing_metrics)


def test_secret_redaction():
    """Ensure API keys and credentials are not leaked into reports."""
    secret_key = "gsk_testsecretgroqkey1234567890abcdef"
    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            GROQ_API_KEY=secret_key,
            ONLINECOMPILER_API_KEY="8dbae643d6d44fae34ed33d9d3817d16",
        )
        orig_code = f"# api key = {secret_key}\nprint('hello')"
        cand_code = "print('hello')"
        orig_vr = VersionResult(status="accepted", stdout=f"Key: {secret_key}", exit_code=0, time_seconds=0.02)
        cand_vr = VersionResult(status="accepted", stdout="clean", exit_code=0, time_seconds=0.02)

        report = generate_proof_report(
            language="python",
            original_code=orig_code,
            candidate_code=cand_code,
            test_inputs=[secret_key],
            orig_vr=orig_vr,
            cand_vr=cand_vr,
            outputs_match=False,
        )

        report_json = report.model_dump_json()
        assert secret_key not in report_json
        assert "[REDACTED_CREDENTIAL]" in report_json

        html_out = export_proof_report_html(report)
        assert secret_key not in html_out
        assert "[REDACTED_CREDENTIAL]" in html_out


def test_export_proof_report_html():
    """Verify HTML export produces complete, valid HTML with expected sections."""
    orig_vr = VersionResult(status="accepted", stdout="out\n", exit_code=0, time_seconds=0.05, memory_kb=12000)
    cand_vr = VersionResult(status="accepted", stdout="out\n", exit_code=0, time_seconds=0.03, memory_kb=10000)

    report = generate_proof_report(
        language="python",
        original_code="print('out')",
        candidate_code="print('out')",
        test_inputs=["in1"],
        orig_vr=orig_vr,
        cand_vr=cand_vr,
        outputs_match=True,
        time_delta_seconds=-0.02,
        memory_delta_kb=-2000,
    )

    html_out = export_proof_report_html(report)
    assert "<!DOCTYPE html>" in html_out
    assert report.id in html_out
    assert report.source["original"].sha256 in html_out
    assert report.source["candidate"].sha256 in html_out
    assert "Verified for tested cases" in html_out
    assert "Performance Improvement" in html_out
    assert "Execution Outcomes" in html_out


@pytest.mark.asyncio
async def test_compare_endpoint_includes_proof_report():
    """Verify /api/v1/compare endpoint response includes proof_report."""
    mock_orig = ExecuteResponse(status="accepted", stdout="result\n", exit_code=0, time_seconds=0.04, memory_kb=12000)
    mock_cand = ExecuteResponse(status="accepted", stdout="result\n", exit_code=0, time_seconds=0.02, memory_kb=11000)

    with patch("app.services.benchmark_service.execute_code") as mock_exec:
        mock_exec.side_effect = [mock_orig, mock_cand]

        resp = client.post("/api/v1/compare", json={
            "language": "python",
            "original_code": "print('result')",
            "candidate_code": "print('result')",
            "test_inputs": [],
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["outputs_match"] is True
        assert data["verdict"] == "improvement"
        assert "proof_report" in data
        assert data["proof_report"] is not None
        pr = data["proof_report"]
        assert pr["correctness"]["status"] == "verified"
        assert pr["performance"]["verdict"] == "improvement"
        assert len(pr["source"]["original"]["sha256"]) == 64


@pytest.mark.asyncio
async def test_compare_report_html_endpoint():
    """Verify /api/v1/compare/report/html endpoint returns text/html."""
    mock_orig = ExecuteResponse(status="accepted", stdout="same\n", exit_code=0, time_seconds=0.03, memory_kb=10000)
    mock_cand = ExecuteResponse(status="accepted", stdout="same\n", exit_code=0, time_seconds=0.03, memory_kb=10000)

    with patch("app.services.benchmark_service.execute_code") as mock_exec:
        mock_exec.side_effect = [mock_orig, mock_cand]

        resp = client.post("/api/v1/compare/report/html", json={
            "language": "python",
            "original_code": "print('same')",
            "candidate_code": "print('same')",
            "test_inputs": [],
        })

        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "<!DOCTYPE html>" in resp.text
        assert "ReCodeX Proof-Carrying Optimization Report" in resp.text
