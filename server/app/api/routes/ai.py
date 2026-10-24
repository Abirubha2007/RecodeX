"""AI endpoints – explain and optimize."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.core import config
from app.schemas import (
    ExplainRequest, ExplainResponse,
    OptimizeRequest, OptimizeResponse,
)
from app.services import groq_service

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("recodex.routes.ai")


def _require_groq():
    settings = config.get_settings()
    if not settings.groq_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI features are not configured. "
                "Add GROQ_API_KEY to your .env file to enable them."
            ),
        )


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest, request: Request):
    _require_groq()
    settings = config.get_settings()
    if len(req.source_code.encode()) > settings.max_code_bytes:
        raise HTTPException(status_code=413, detail="Source code too large.")

    logger.info(
        "AI explain [%s] type=%s lang=%s",
        getattr(request.state, "request_id", "?"),
        req.explain_type,
        req.language,
    )
    try:
        if req.explain_type == "error":
            result = groq_service.explain_error(req.language, req.source_code, req.context or "")
        elif req.explain_type == "complexity":
            result = groq_service.explain_complexity(req.language, req.source_code, req.context or "")
        elif req.explain_type == "diff":
            result = groq_service.explain_diff(req.language, req.source_code, req.context or "")
        elif req.explain_type == "edge_cases":
            result = groq_service.suggest_edge_cases(req.language, req.source_code)
        else:
            result = groq_service.explain_code(req.language, req.source_code, req.context)
        return ExplainResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest, request: Request):
    _require_groq()
    settings = config.get_settings()
    if len(req.source_code.encode()) > settings.max_code_bytes:
        raise HTTPException(status_code=413, detail="Source code too large.")

    logger.info(
        "AI optimize [%s] lang=%s",
        getattr(request.state, "request_id", "?"),
        req.language,
    )
    try:
        result = groq_service.suggest_optimization(req.language, req.source_code, req.context)
        return OptimizeResponse(result=result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
