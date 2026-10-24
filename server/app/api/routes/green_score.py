"""Green Score endpoint."""

import logging
from fastapi import APIRouter, HTTPException, Request

from app.core import config
from app.schemas import GreenScoreRequest, GreenScoreResponse
from app.services.green_score_service import calculate_green_score

router = APIRouter(tags=["green-score"])
logger = logging.getLogger("recodex.routes.green_score")


@router.post("/green-score", response_model=GreenScoreResponse)
def green_score(req: GreenScoreRequest, request: Request):
    settings = config.get_settings()

    if len(req.source_code.encode()) > settings.max_code_bytes:
        raise HTTPException(status_code=413, detail="Source code too large.")

    logger.info(
        "Green score [%s] lang=%s has_exec=%s has_analysis=%s",
        getattr(request.state, "request_id", "?"),
        req.language,
        req.execute_result is not None,
        req.analyze_result is not None,
    )

    result = calculate_green_score(
        language=req.language,
        source_code=req.source_code,
        execute_result=req.execute_result,
        analyze_result=req.analyze_result,
    )
    return result
