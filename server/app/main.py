"""
ReCodeX FastAPI Application Entry Point
"""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.api.routes import health, languages, execute, analyze, ai, compare, benchmark, green_score

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("recodex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("ReCodeX starting – env=%s debug=%s", settings.APP_ENV, settings.APP_DEBUG)
    yield
    logger.info("ReCodeX shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="ReCodeX API",
        description="AI-powered coding workspace backend",
        version="1.0.0",
        docs_url="/docs" if settings.APP_DEBUG else None,
        redoc_url="/redoc" if settings.APP_DEBUG else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request-ID middleware ─────────────────────────────────────────────────
    @app.middleware("http")
    async def attach_request_id(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # ── Global error handler ──────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "unknown")
        logger.error("Unhandled exception [%s]: %s", request_id, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "request_id": request_id,
            },
        )

    # ── Routes ────────────────────────────────────────────────────────────────
    prefix = "/api/v1"
    app.include_router(health.router, prefix=prefix)
    app.include_router(languages.router, prefix=prefix)
    app.include_router(execute.router, prefix=prefix)
    app.include_router(analyze.router, prefix=prefix)
    app.include_router(ai.router, prefix=prefix)
    app.include_router(compare.router, prefix=prefix)
    app.include_router(benchmark.router, prefix=prefix)
    app.include_router(green_score.router, prefix=prefix)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.APP_DEBUG,
        log_level="info",
    )
