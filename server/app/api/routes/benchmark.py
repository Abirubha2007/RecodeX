"""Benchmark endpoint."""

import asyncio
import logging
from fastapi import APIRouter, HTTPException, Request

from app.core import config
from app.schemas import BenchmarkRequest, BenchmarkDataPoint, BenchmarkResponse
from app.services.execution_service import execute_code

router = APIRouter(tags=["benchmark"])
logger = logging.getLogger("recodex.routes.benchmark")


@router.post("/benchmark", response_model=BenchmarkResponse)
async def benchmark(req: BenchmarkRequest, request: Request):
    settings = config.get_settings()

    if len(req.source_code.encode()) > settings.max_code_bytes:
        raise HTTPException(status_code=413, detail="Source code too large.")

    total_runs = len(req.inputs) * req.repetitions
    if total_runs > 30:
        raise HTTPException(
            status_code=400,
            detail=f"Total runs ({total_runs}) exceeds limit of 30. Reduce inputs or repetitions.",
        )

    logger.info(
        "Benchmark [%s] lang=%s inputs=%d reps=%d",
        getattr(request.state, "request_id", "?"),
        req.language,
        len(req.inputs),
        req.repetitions,
    )

    results: list[BenchmarkDataPoint] = []
    for inp in req.inputs:
        times = []
        memories = []
        last_status = "accepted"
        for _ in range(req.repetitions):
            r = await execute_code(req.language, req.source_code, inp)
            last_status = r.status
            if r.time_seconds is not None:
                times.append(r.time_seconds)
            if r.memory_kb is not None:
                memories.append(r.memory_kb)

        avg_time = sum(times) / len(times) if times else None
        avg_mem = int(sum(memories) / len(memories)) if memories else None
        label = inp[:40] + "..." if len(inp) > 40 else (inp or "<empty>")
        results.append(BenchmarkDataPoint(
            input_label=label,
            time_seconds=round(avg_time, 4) if avg_time is not None else None,
            memory_kb=avg_mem,
            status=last_status,
        ))

    summary = (
        f"Benchmarked {len(req.inputs)} input(s) × {req.repetitions} repetition(s). "
        f"Times and memory are averages across repetitions."
    )
    limitations = [
        "Measurements are subject to execution provider scheduling and hardware variability.",
        "Memory measurements depend on provider support (may be None).",
        "Do not compare results across different execution provider configurations.",
    ]
    return BenchmarkResponse(results=results, summary=summary, limitations=limitations)
