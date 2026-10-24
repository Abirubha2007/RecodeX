"""Analyze endpoint."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import analyze_code
from app.services.complexity_service import estimate_complexity

router = APIRouter(tags=["analysis"])
logger = logging.getLogger("recodex.routes.analyze")


@router.post("/analyze", response_model=AnalyzeResponse)
def run_analysis(req: AnalyzeRequest, request: Request):
    settings = get_settings()

    if len(req.source_code.encode()) > settings.max_code_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Source code exceeds {settings.MAX_CODE_SIZE_KB} KB limit.",
        )

    logger.info(
        "Analyze request [%s] lang=%s",
        getattr(request.state, "request_id", "?"),
        req.language,
    )

    findings = analyze_code(req.language, req.source_code)
    complexity = estimate_complexity(req.language, req.source_code)

    return AnalyzeResponse(
        language=req.language,
        findings=findings,
        complexity=complexity,
        analysis_source="static",
    )
