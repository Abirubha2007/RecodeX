"""Health check endpoint."""

from fastapi import APIRouter
from app.core import config

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    settings = config.get_settings()
    return {
        "status": "ok",
        "version": "1.0.0",
        "env": settings.APP_ENV,
        "features": {
            "execution": settings.execution_configured,
            "ai": settings.groq_configured,
        },
    }
