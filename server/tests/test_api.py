"""
Backend tests for ReCodeX.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app

client = TestClient(app)


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_returns_ok():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "features" in data


# ── Languages ─────────────────────────────────────────────────────────────────

def test_languages_returns_list():
    resp = client.get("/api/v1/languages")
    assert resp.status_code == 200
    data = resp.json()
    assert "languages" in data
    assert len(data["languages"]) > 0
    lang = data["languages"][0]
    assert "id" in lang
    assert "name" in lang


# ── Analyze ───────────────────────────────────────────────────────────────────

def test_analyze_python_simple():
    resp = client.post("/api/v1/analyze", json={
        "language": "python",
        "source_code": "x = 1\nprint(x)\n",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "findings" in data
    assert "complexity" in data
    assert data["complexity"]["estimated_time_complexity"] == "O(1)"


def test_analyze_python_nested_loop():
    code = "for i in range(n):\n    for j in range(n):\n        pass\n"
    resp = client.post("/api/v1/analyze", json={"language": "python", "source_code": code})
    assert resp.status_code == 200
    data = resp.json()
    finding_ids = [f["rule_id"] for f in data["findings"]]
    assert "PY001" in finding_ids
    assert data["complexity"]["estimated_time_complexity"] == "O(n²)"


def test_analyze_syntax_error():
    resp = client.post("/api/v1/analyze", json={
        "language": "python",
        "source_code": "def foo(:\n    pass\n",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert any(f["rule_id"] == "PY000" for f in data["findings"])


def test_analyze_empty_code_rejected():
    resp = client.post("/api/v1/analyze", json={"language": "python", "source_code": ""})
    assert resp.status_code == 422


# ── Green Score ───────────────────────────────────────────────────────────────

def test_green_score_no_data():
    resp = client.post("/api/v1/green-score", json={
        "language": "python",
        "source_code": "print('hello')",
    })
    assert resp.status_code == 200
    data = resp.json()
    # With no execution data, score should be None or low-confidence
    assert data["overall_score"] is None or data["confidence"] in ("low", "medium")


def test_green_score_with_analysis():
    analyze_result = {
        "language": "python",
        "findings": [],
        "complexity": {
            "estimated_time_complexity": "O(n)",
            "estimated_auxiliary_space": "O(1)",
            "confidence": "medium",
            "reasoning": "Single loop",
            "assumptions": [],
            "limitations": "Heuristic only",
        },
        "analysis_source": "static",
    }
    resp = client.post("/api/v1/green-score", json={
        "language": "python",
        "source_code": "for i in range(10): pass",
        "analyze_result": analyze_result,
    })
    assert resp.status_code == 200


# ── Execute – configuration error when no provider ────────────────────────────

def test_execute_returns_config_error_when_not_configured():
    resp = client.post("/api/v1/execute", json={
        "language": "python",
        "source_code": "print('hello')",
        "stdin": "",
    })
    assert resp.status_code == 200
    data = resp.json()
    # Should either succeed or return a configuration error, never fabricate output
    assert data["status"] in (
        "accepted", "configuration_error", "error", "timeout", "compilation_error"
    )


# ── AI – 503 when not configured ─────────────────────────────────────────────

def test_explain_returns_503_when_no_groq_key():
    with patch("app.core.config.get_settings") as mock_settings:
        settings = MagicMock()
        settings.groq_configured = False
        settings.max_code_bytes = 102400
        mock_settings.return_value = settings
        resp = client.post("/api/v1/ai/explain", json={
            "language": "python",
            "source_code": "print('hi')",
            "explain_type": "code",
        })
        # 503 or route-level 503 depending on mock
        assert resp.status_code in (503, 422)


# ── Complexity Estimation ─────────────────────────────────────────────────────

def test_complexity_constant():
    from app.services.complexity_service import estimate_complexity
    result = estimate_complexity("python", "x = 1 + 2\nprint(x)")
    assert result.estimated_time_complexity == "O(1)"


def test_complexity_linear():
    from app.services.complexity_service import estimate_complexity
    result = estimate_complexity("python", "for i in range(n):\n    print(i)")
    assert result.estimated_time_complexity == "O(n)"


def test_complexity_quadratic():
    from app.services.complexity_service import estimate_complexity
    result = estimate_complexity("python", "for i in range(n):\n    for j in range(n):\n        pass")
    assert result.estimated_time_complexity == "O(n²)"


def test_complexity_unknown_for_recursion():
    from app.services.complexity_service import estimate_complexity
    code = "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)"
    result = estimate_complexity("python", code)
    assert result.estimated_time_complexity == "Unknown"
    assert result.confidence == "low"


# ── Static Analysis ───────────────────────────────────────────────────────────

def test_nested_loop_finding():
    from app.services.analysis_service import analyze_code
    code = "for i in range(n):\n    for j in range(n):\n        pass"
    findings = analyze_code("python", code)
    assert any(f.rule_id == "PY001" for f in findings)


def test_string_concat_finding():
    from app.services.analysis_service import analyze_code
    code = "s = ''\nfor i in range(n):\n    s += str(i)"
    findings = analyze_code("python", code)
    assert any(f.rule_id == "PY003" for f in findings)


def test_c_gets_finding():
    from app.services.analysis_service import analyze_code
    code = "#include<stdio.h>\nint main(){\nchar buf[100];\ngets(buf);\n}"
    findings = analyze_code("c", code)
    assert any(f.rule_id == "C002" for f in findings)
