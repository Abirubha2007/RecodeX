"""
ReCodeX – Typed application settings.

Loads from the root .env file in development; production deployments
override individual variables through the process environment.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("recodex.config")

# Resolve .env relative to the repository root (two levels above this file)
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV) if _ROOT_ENV.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────────────────────────
    PORT: int = 8000
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # ── Groq AI ───────────────────────────────────────────────────────────────
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = Field(
        default='["http://localhost:5173"]',
        description="JSON array of allowed origins",
    )

    # ── Execution provider ────────────────────────────────────────────────────
    EXECUTION_PROVIDER: str = "judge0"
    JUDGE0_BASE_URL: Optional[str] = None
    JUDGE0_API_KEY: Optional[str] = None

    # ── Storage ───────────────────────────────────────────────────────────────
    DATABASE_URL: Optional[str] = None

    # ── Limits ────────────────────────────────────────────────────────────────
    EXECUTION_TIMEOUT_SECONDS: int = 5
    MAX_CODE_SIZE_KB: int = 100
    MAX_OUTPUT_SIZE_KB: int = 256

    # ── Derived ───────────────────────────────────────────────────────────────
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _normalize_cors(cls, v):
        """Accept both a raw JSON string and a plain comma-separated list."""
        if isinstance(v, list):
            return json.dumps(v)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            origins = json.loads(self.CORS_ORIGINS)
            if isinstance(origins, list):
                return [str(o) for o in origins]
        except (json.JSONDecodeError, TypeError):
            pass
        # Fallback: split on comma
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def groq_configured(self) -> bool:
        return bool(self.GROQ_API_KEY)

    @property
    def execution_configured(self) -> bool:
        return bool(self.JUDGE0_BASE_URL)

    @property
    def max_code_bytes(self) -> int:
        return self.MAX_CODE_SIZE_KB * 1024

    @property
    def max_output_bytes(self) -> int:
        return self.MAX_OUTPUT_SIZE_KB * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    s = Settings()
    if not s.groq_configured:
        logger.warning(
            "GROQ_API_KEY is not set – AI features will be unavailable. "
            "Set GROQ_API_KEY in your .env file to enable them."
        )
    if not s.execution_configured:
        logger.warning(
            "JUDGE0_BASE_URL is not set – code execution will be unavailable. "
            "Configure an execution provider in your .env file."
        )
    return s
