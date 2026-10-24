"""
Tests for OnlineCompiler.io execution adapter and error handling.
"""

from unittest.mock import patch, AsyncMock
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.services.execution_service import execute_code

client = TestClient(app)


@pytest.mark.asyncio
async def test_successful_execution_normalized():
    """Verify successful execution returns status='accepted' and parsed stdout/time/memory."""
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "output": "Hello from Python!\n",
            "error": "",
            "status": "success",
            "exit_code": 0,
            "signal": None,
            "time": "0.0350",
            "total": "0.0410",
            "memory": "12288",
        },
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
            ONLINECOMPILER_BASE_URL="https://api.onlinecompiler.io",
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("python", "print('Hello from Python!')")

            assert res.status == "accepted"
            assert res.stdout == "Hello from Python!\n"
            assert res.exit_code == 0
            assert res.time_seconds == 0.035
            assert res.memory_kb == 12288
            assert res.compile_output is None


@pytest.mark.asyncio
async def test_compilation_error_normalized():
    """Verify compilation failure returns status='compilation_error' and compile_output."""
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "output": "",
            "error": "code.c:4:5: error: expected ';' before 'return'",
            "status": "error",
            "exit_code": 1,
            "signal": None,
            "time": "0.0100",
            "memory": "4096",
        },
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("c", "int main() { return 0 }")

            assert res.status == "compilation_error"
            assert "error: expected ';'" in (res.compile_output or "")
            assert res.exit_code == 1


@pytest.mark.asyncio
async def test_timeout_normalized():
    """Verify exit_code 124 or timeout error message is normalized to status='timeout'."""
    mock_resp = httpx.Response(
        status_code=200,
        json={
            "output": "",
            "error": "Execution timed out after 5 seconds.",
            "status": "error",
            "exit_code": 124,
            "signal": None,
            "time": "5.0000",
            "memory": "8192",
        },
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("python", "while True: pass")

            assert res.status == "timeout"
            assert "timed out" in (res.message or "").lower()


@pytest.mark.asyncio
async def test_http_timeout_exception_normalized():
    """Verify httpx.TimeoutException is normalized to status='timeout'."""
    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timeout")):
            res = await execute_code("python", "import time; time.sleep(10)")

            assert res.status == "timeout"
            assert "timed out" in (res.message or "").lower()


@pytest.mark.asyncio
async def test_authentication_failure_401():
    """Verify HTTP 401 returns actionable error and does not leak API key."""
    mock_resp = httpx.Response(
        status_code=401,
        text='{"detail": "Invalid API key"}',
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        secret_key = "secret_oc_key_never_leak"
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY=secret_key,
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("python", "print('test')")

            assert res.status == "error"
            assert "Authentication failed" in (res.message or "")
            assert secret_key not in (res.message or "")


@pytest.mark.asyncio
async def test_rate_limit_429():
    """Verify HTTP 429 returns rate limit error message."""
    mock_resp = httpx.Response(
        status_code=429,
        text='{"detail": "Rate limit exceeded"}',
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("python", "print('test')")

            assert res.status == "error"
            assert "rate limit" in (res.message or "").lower()


@pytest.mark.asyncio
async def test_malformed_json_response():
    """Verify malformed JSON or non-dict response handled gracefully."""
    mock_resp = httpx.Response(
        status_code=200,
        text="<!DOCTYPE html><html>Gateway error</html>",
        request=httpx.Request("POST", "https://api.onlinecompiler.io/api/run-code-sync/"),
    )

    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            res = await execute_code("python", "print('test')")

            assert res.status == "error"
            assert "Invalid JSON" in (res.message or "")


@pytest.mark.asyncio
async def test_unsupported_language():
    """Verify unsupported language returns clean error."""
    with patch("app.core.config.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            ONLINECOMPILER_API_KEY="test_key_valid",
        )
        res = await execute_code("cobol", "DISPLAY 'Hello'")
        assert res.status == "error"
        assert "not supported" in (res.message or "")
