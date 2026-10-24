"""Execute endpoint."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.schemas import ExecuteRequest, ExecuteResponse
from app.services.execution_service import execute_code

router = APIRouter(tags=["execution"])
logger = logging.getLogger("recodex.routes.execute")


@router.post("/execute", response_model=ExecuteResponse)
async def run_code(req: ExecuteRequest, request: Request):
    settings = get_settings()

    # Validate size
    code_bytes = len(req.source_code.encode())
    if code_bytes > settings.max_code_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Source code exceeds {settings.MAX_CODE_SIZE_KB} KB limit.",
        )

    stdin_bytes = len((req.stdin or "").encode())
    if stdin_bytes > 65536:
        raise HTTPException(status_code=413, detail="stdin exceeds 64 KB limit.")

    logger.info(
        "Execute request [%s] lang=%s size=%d",
        getattr(request.state, "request_id", "?"),
        req.language,
        code_bytes,
    )

    result = await execute_code(req.language, req.source_code, req.stdin or "")
    return result
