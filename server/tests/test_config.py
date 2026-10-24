"""
Tests for ReCodeX environment configuration and secret protection.
"""

import os
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings, Settings
from app.main import app

client = TestClient(app)


def test_root_env_loads_correctly():
    """Verify that root-level .env settings are loaded into Settings."""
    get_settings.cache_clear()
    settings = get_settings()

    # Base types and defaults/env values
    assert isinstance(settings.PORT, int)
    assert settings.PORT == 8000
    assert settings.APP_ENV == "development"
    assert settings.APP_DEBUG is True
    assert settings.EXECUTION_PROVIDER == "onlinecompiler"
    assert settings.ONLINECOMPILER_BASE_URL == "https://api.onlinecompiler.io"
    assert settings.EXECUTION_TIMEOUT_SECONDS == 5
    assert settings.MAX_CODE_SIZE_KB == 100
    assert settings.MAX_OUTPUT_SIZE_KB == 256


def test_cors_origins_json_array_parsed():
    """Verify CORS_ORIGINS is parsed correctly into a list of origins."""
    get_settings.cache_clear()
    settings = get_settings()
    origins = settings.cors_origins_list

    assert isinstance(origins, list)
    assert "http://localhost:5173" in origins
    assert "https://your-frontend.onrender.com" in origins


def test_cors_origins_comma_separated_fallback():
    """Verify CORS_ORIGINS parses comma-separated strings as fallback."""
    s = Settings(CORS_ORIGINS="http://localhost:3000, https://app.example.com")
    origins = s.cors_origins_list
    assert origins == ["http://localhost:3000", "https://app.example.com"]


def test_placeholder_groq_key_detected_as_unconfigured():
    """Placeholder keys like 'your_groq_api_key_here' must be treated as unconfigured."""
    s = Settings(GROQ_API_KEY="your_groq_api_key_here")
    assert s.groq_configured is False

    s2 = Settings(GROQ_API_KEY="")
    assert s2.groq_configured is False

    s3 = Settings(GROQ_API_KEY=None)
    assert s3.groq_configured is False

    # Valid key
    s4 = Settings(GROQ_API_KEY="gsk_actual_key_12345")
    assert s4.groq_configured is True


def test_missing_onlinecompiler_detected_as_unconfigured():
    """Missing, empty, or placeholder OnlineCompiler key must be treated as unconfigured."""
    s = Settings(ONLINECOMPILER_API_KEY="")
    assert s.execution_configured is False

    s2 = Settings(ONLINECOMPILER_API_KEY=None)
    assert s2.execution_configured is False

    s3 = Settings(ONLINECOMPILER_API_KEY="your_onlinecompiler_api_key_here")
    assert s3.execution_configured is False

    # Valid key
    s4 = Settings(ONLINECOMPILER_API_KEY="oc_live_key_987654321")
    assert s4.execution_configured is True


def test_env_var_override():
    """Process environment variables should override default values."""
    with patch.dict(os.environ, {"PORT": "9090", "APP_ENV": "staging"}):
        s = Settings()
        assert s.PORT == 9090
        assert s.APP_ENV == "staging"


def test_health_endpoint_does_not_leak_secrets():
    """Health endpoint must only report booleans and public info, never secrets."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert "features" in data
    assert isinstance(data["features"]["execution"], bool)
    assert isinstance(data["features"]["ai"], bool)

    # Ensure no credential keys are present in the response
    raw_text = resp.text.lower()
    assert "groq_api_key" not in raw_text
    assert "onlinecompiler_api_key" not in raw_text
    assert "judge0_api_key" not in raw_text
    assert "your_groq_api_key_here" not in raw_text


def test_ai_endpoint_returns_actionable_error_when_unconfigured():
    """Calling AI endpoint without valid Groq key must return a clean 503 error."""
    with patch("app.core.config.get_settings") as mock_get_settings:
        mock_s = Settings(GROQ_API_KEY=None)
        mock_get_settings.return_value = mock_s
        resp = client.post("/api/v1/ai/explain", json={
            "language": "python",
            "source_code": "print('hello')",
            "explain_type": "code",
        })
        assert resp.status_code == 503
        data = resp.json()
        assert "GROQ_API_KEY" in data.get("detail", "")


def test_execute_endpoint_returns_actionable_error_when_unconfigured():
    """Calling execute endpoint without configured OnlineCompiler must return configuration_error."""
    with patch("app.core.config.get_settings") as mock_get_settings:
        mock_s = Settings(ONLINECOMPILER_API_KEY=None, JUDGE0_BASE_URL=None)
        mock_get_settings.return_value = mock_s
        resp = client.post("/api/v1/execute", json={
            "language": "python",
            "source_code": "print('hello')",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "configuration_error"
        assert "ONLINECOMPILER_API_KEY" in data.get("message", "")
