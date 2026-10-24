"""
OnlineCompiler.io code execution service.

Source code is NEVER executed inside this process.
All execution happens securely in the remote OnlineCompiler.io sandbox.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from app.core import config
from app.schemas import ExecuteResponse

logger = logging.getLogger("recodex.execution")

# OnlineCompiler.io compiler identifiers
LANGUAGE_MAP: Dict[str, str] = {
    "python": "python-3.14",
    "c": "gcc-15",
    "cpp": "g++-15",
    "javascript": "nodejs-24",
    "typescript": "typescript-deno",
    "java": "openjdk-25",
    "go": "go-1.26",
    "rust": "rust-1.93",
}

# Legacy Judge0 IDs preserved for backward compatibility
LEGACY_JUDGE0_MAP: Dict[str, int] = {
    "python": 71,
    "c": 50,
    "cpp": 54,
    "javascript": 63,
    "java": 62,
    "go": 60,
    "rust": 73,
    "typescript": 74,
}


def _build_headers(api_key: Optional[str]) -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-Auth-Token"] = api_key
    return headers


def _parse_time(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_memory(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


async def execute_code(
    language: str,
    source_code: str,
    stdin: str = "",
) -> ExecuteResponse:
    """
    Execute code remotely via the OnlineCompiler.io API and normalize the response.
    Never exposes API keys in logs or responses.
    """
    settings = config.get_settings()

    if not settings.execution_configured:
        return ExecuteResponse(
            status="configuration_error",
            message=(
                "Code execution is not configured. "
                "Set ONLINECOMPILER_API_KEY in your .env file."
            ),
        )

    compiler_id = LANGUAGE_MAP.get(language.lower())
    if compiler_id is None:
        return ExecuteResponse(
            status="error",
            message=f"Language '{language}' is not supported for execution.",
        )

    timeout_seconds = min(max(1, settings.EXECUTION_TIMEOUT_SECONDS), 30)
    payload = {
        "compiler": compiler_id,
        "code": source_code,
        "input": stdin or "",
        "time_limit": timeout_seconds,
    }

    base_url = (settings.ONLINECOMPILER_BASE_URL or "https://api.onlinecompiler.io").rstrip("/")
    url = f"{base_url}/api/run-code-sync/"
    headers = _build_headers(settings.ONLINECOMPILER_API_KEY)

    try:
        async with httpx.AsyncClient(timeout=float(timeout_seconds + 5)) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code == 401:
            logger.warning("OnlineCompiler.io authentication failed (HTTP 401)")
            return ExecuteResponse(
                status="error",
                message="Authentication failed with OnlineCompiler.io. Check ONLINECOMPILER_API_KEY in your .env file.",
            )

        if resp.status_code == 429:
            logger.warning("OnlineCompiler.io rate limit exceeded (HTTP 429)")
            return ExecuteResponse(
                status="error",
                message="OnlineCompiler.io rate limit exceeded. Please try again later.",
            )

        if resp.status_code == 400:
            err_msg = "Bad request"
            try:
                err_data = resp.json()
                err_msg = err_data.get("detail") or err_data.get("error") or err_data.get("message") or resp.text
            except Exception:
                err_msg = resp.text
            logger.warning("OnlineCompiler.io bad request (HTTP 400): %s", err_msg[:200])
            return ExecuteResponse(
                status="error",
                message=f"OnlineCompiler.io rejected request: {err_msg[:200]}",
            )

        if resp.status_code != 200:
            logger.warning("OnlineCompiler.io returned unexpected HTTP status: %d", resp.status_code)
            return ExecuteResponse(
                status="error",
                message=f"Execution provider returned HTTP {resp.status_code}.",
            )

        # Parse JSON response
        try:
            data = resp.json()
            if not isinstance(data, dict):
                return ExecuteResponse(
                    status="error",
                    message="Malformed response from execution provider.",
                )
        except Exception:
            return ExecuteResponse(
                status="error",
                message="Invalid JSON response from execution provider.",
            )

        raw_status = str(data.get("status", "")).lower()
        exit_code = data.get("exit_code")
        stdout = data.get("output")
        stderr = data.get("error")
        time_seconds = _parse_time(data.get("time") or data.get("total"))
        memory_kb = _parse_memory(data.get("memory"))

        # Determine normalized status
        status: str
        compile_output: Optional[str] = None
        message: Optional[str] = None

        is_timeout = (
            exit_code in (124, 137)
            or raw_status == "timeout"
            or (isinstance(stderr, str) and any(kw in stderr.lower() for kw in ("timed out", "time limit exceeded")))
        )

        if is_timeout:
            status = "timeout"
            message = "Execution timed out."
        elif exit_code == 0 and raw_status in ("success", "ok", "accepted", "0", ""):
            status = "accepted"
        else:
            # Check for compilation errors
            stderr_str = str(stderr or "").lower()
            is_compilation_error = (
                not stdout
                and any(kw in stderr_str for kw in (
                    "error:", "syntax error", "fatal error:", "compilation error",
                    "undefined reference", "cannot find symbol", "could not compile",
                    "expected ';'", "error[e", "declared void"
                ))
            )
            if is_compilation_error:
                status = "compilation_error"
                compile_output = stderr
            elif exit_code != 0:
                status = "runtime_error"
            else:
                status = "accepted" if stdout is not None else "error"

        return ExecuteResponse(
            status=status,
            stdout=stdout,
            stderr=stderr,
            compile_output=compile_output,
            exit_code=exit_code,
            time_seconds=time_seconds,
            memory_kb=memory_kb,
            message=message,
        )

    except httpx.TimeoutException:
        logger.info("Request to OnlineCompiler.io timed out")
        return ExecuteResponse(status="timeout", message="Request to execution provider timed out.")
    except Exception as e:
        logger.error("Unexpected execution error: %s", e, exc_info=True)
        return ExecuteResponse(status="error", message="An unexpected error occurred during execution.")
