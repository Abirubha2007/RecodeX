"""Compare endpoint."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.schemas import CompareRequest, CompareResponse
from app.services.benchmark_service import compare_versions

router = APIRouter(tags=["compare"])
logger = logging.getLogger("recodex.routes.compare")


@router.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest, request: Request):
    settings = get_settings()
    limit = settings.max_code_bytes

    if len(req.original_code.encode()) > limit or len(req.candidate_code.encode()) > limit:
        raise HTTPException(status_code=413, detail="Code exceeds size limit.")

    if len(req.test_inputs) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 test inputs for comparison.")

    logger.info(
        "Compare request [%s] lang=%s inputs=%d",
        getattr(request.state, "request_id", "?"),
        req.language,
        len(req.test_inputs),
    )

    result = await compare_versions(
        req.language,
        req.original_code,
        req.candidate_code,
        req.test_inputs,
    )
    return result
