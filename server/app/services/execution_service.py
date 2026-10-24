"""
Judge0-compatible code execution service.

Source code is NEVER executed inside this process.
All execution happens in the remote isolated environment.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import get_settings
from app.schemas import ExecuteResponse

logger = logging.getLogger("recodex.execution")

# Verified Judge0 language IDs (from Judge0 /languages endpoint)
LANGUAGE_MAP: Dict[str, int] = {
    "python": 71,   # Python 3.8
    "c": 50,        # C (GCC 9.2)
    "cpp": 54,      # C++ (GCC 9.2)
    "javascript": 63,  # JavaScript (Node.js 12)
    "java": 62,     # Java (OpenJDK 13)
    "go": 60,       # Go
    "rust": 73,     # Rust
    "typescript": 74,  # TypeScript
}

# Human-readable status map from Judge0 status IDs
STATUS_MAP: Dict[int, str] = {
    1: "in_queue",
    2: "processing",
    3: "accepted",
    4: "wrong_answer",
    5: "time_limit_exceeded",
    6: "compilation_error",
    7: "runtime_error_sigsegv",
    8: "runtime_error_sigfpe",
    9: "runtime_error_sigabrt",
    10: "runtime_error_nzec",
    11: "runtime_error_other",
    12: "internal_error",
    13: "exec_format_error",
}


def _decode(value: Optional[str]) -> Optional[str]:
    """Base64-decode Judge0 output fields when present."""
    if not value:
        return None
    try:
        return base64.b64decode(value).decode("utf-8", errors="replace")
    except Exception:
        return value


def _build_headers() -> Dict[str, str]:
    settings = get_settings()
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.JUDGE0_API_KEY:
        headers["X-Auth-Token"] = settings.JUDGE0_API_KEY
        headers["X-RapidAPI-Key"] = settings.JUDGE0_API_KEY
    return headers


async def execute_code(
    language: str,
    source_code: str,
    stdin: str = "",
) -> ExecuteResponse:
    settings = get_settings()

    if not settings.execution_configured:
        return ExecuteResponse(
            status="configuration_error",
            message=(
                "Code execution is not configured. "
                "Set JUDGE0_BASE_URL (and optionally JUDGE0_API_KEY) in your .env file."
            ),
        )

    judge0_id = LANGUAGE_MAP.get(language.lower())
    if judge0_id is None:
        return ExecuteResponse(
            status="error",
            message=f"Language '{language}' is not supported for execution.",
        )

    encoded_source = base64.b64encode(source_code.encode()).decode()
    encoded_stdin = base64.b64encode((stdin or "").encode()).decode()

    payload = {
        "language_id": judge0_id,
        "source_code": encoded_source,
        "stdin": encoded_stdin,
        "cpu_time_limit": settings.EXECUTION_TIMEOUT_SECONDS,
        "wall_time_limit": settings.EXECUTION_TIMEOUT_SECONDS + 2,
        "memory_limit": 256000,  # 256 MB
        "encode_input": False,
        "encode_output": False,  # we send base64 ourselves
    }

    base_url = settings.JUDGE0_BASE_URL.rstrip("/")
    headers = _build_headers()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Submit
            submit_resp = await client.post(
                f"{base_url}/submissions?base64_encoded=true&wait=false",
                json=payload,
                headers=headers,
            )
            submit_resp.raise_for_status()
            token = submit_resp.json().get("token")
            if not token:
                return ExecuteResponse(status="error", message="Execution provider returned no token.")

            # Poll for result
            for _ in range(15):
                await asyncio.sleep(1)
                result_resp = await client.get(
                    f"{base_url}/submissions/{token}?base64_encoded=true",
                    headers=headers,
                )
                result_resp.raise_for_status()
                result = result_resp.json()
                status_id = result.get("status", {}).get("id", 0)
                if status_id > 2:  # Finished
                    break
            else:
                return ExecuteResponse(status="timeout", message="Execution timed out waiting for result.")

        status_str = STATUS_MAP.get(status_id, "unknown")
        stdout = _decode(result.get("stdout"))
        stderr = _decode(result.get("stderr"))
        compile_output = _decode(result.get("compile_output"))
        time_str = result.get("time")
        memory = result.get("memory")

        return ExecuteResponse(
            status=status_str,
            stdout=stdout,
            stderr=stderr,
            compile_output=compile_output,
            exit_code=result.get("exit_code"),
            time_seconds=float(time_str) if time_str else None,
            memory_kb=int(memory) if memory else None,
            message=result.get("message"),
        )

    except httpx.TimeoutException:
        return ExecuteResponse(status="timeout", message="Request to execution provider timed out.")
    except httpx.HTTPStatusError as e:
        logger.warning("Judge0 HTTP error: %s", e)
        return ExecuteResponse(
            status="error",
            message=f"Execution provider returned HTTP {e.response.status_code}.",
        )
    except Exception as e:
        logger.error("Unexpected execution error: %s", e, exc_info=True)
        return ExecuteResponse(status="error", message="An unexpected error occurred during execution.")
