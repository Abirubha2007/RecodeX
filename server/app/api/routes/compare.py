"""Compare endpoint."""

import logging
from fastapi import APIRouter, HTTPException, Request, Response

from app.core import config
from app.schemas import CompareRequest, CompareResponse, ProofReport
from app.services.benchmark_service import compare_versions
from app.services.proof_service import export_proof_report_html

router = APIRouter(tags=["compare"])
logger = logging.getLogger("recodex.routes.compare")


def _check_limits(req: CompareRequest):
    settings = config.get_settings()
    limit = settings.max_code_bytes

    if len(req.original_code.encode()) > limit or len(req.candidate_code.encode()) > limit:
        raise HTTPException(status_code=413, detail="Code exceeds size limit.")

    if len(req.test_inputs) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 test inputs for comparison.")


@router.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest, request: Request):
    _check_limits(req)

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


@router.post("/compare/report", response_model=ProofReport)
async def compare_report(req: CompareRequest, request: Request):
    _check_limits(req)
    result = await compare_versions(
        req.language,
        req.original_code,
        req.candidate_code,
        req.test_inputs,
    )
    if not result.proof_report:
        raise HTTPException(status_code=500, detail="Could not generate proof report.")
    return result.proof_report


@router.post("/compare/report/html")
async def compare_report_html(req: CompareRequest, request: Request):
    _check_limits(req)
    result = await compare_versions(
        req.language,
        req.original_code,
        req.candidate_code,
        req.test_inputs,
    )
    if not result.proof_report:
        raise HTTPException(status_code=500, detail="Could not generate proof report.")
    html_content = export_proof_report_html(result.proof_report)
    return Response(content=html_content, media_type="text/html")

