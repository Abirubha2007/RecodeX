"""
ReCodeX – Typed application settings.

Loads from the root .env file in development; production deployments
override individual variables through the process environment.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("recodex.config")

# Resolve candidate locations for .env:
# 1. Root repository directory: C:\Users\...\RecodeX\.env
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
# 2. Server directory: C:\Users\...\RecodeX\server\.env
_SERVER_ENV = Path(__file__).resolve().parents[2] / ".env"
# 3. Current working directory .env
_CWD_ENV = Path.cwd() / ".env"

_CANDIDATE_ENVS = (_ROOT_ENV, _SERVER_ENV, _CWD_ENV, Path(".env"))


def _load_env_files() -> None:
    """Load variables from .env into os.environ if present, without overriding existing env vars."""
    for candidate in (_ROOT_ENV, _SERVER_ENV, _CWD_ENV):
        try:
            if candidate.is_file():
                load_dotenv(dotenv_path=candidate, override=False)
                break
        except Exception:
            pass


# Pre-load on import
_load_env_files()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, _SERVER_ENV, ".env"),
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
        description="JSON array or comma-separated string of allowed origins",
    )

    # ── Execution provider ────────────────────────────────────────────────────
    EXECUTION_PROVIDER: str = "onlinecompiler"
    ONLINECOMPILER_BASE_URL: str = "https://api.onlinecompiler.io"
    ONLINECOMPILER_API_KEY: Optional[str] = None
    # Backward-compatible fallbacks
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
        """Accept both a raw JSON string and a list."""
        if isinstance(v, list):
            return json.dumps(v)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        raw = str(self.CORS_ORIGINS).strip()
        # 1. Try standard JSON array parsing
        try:
            origins = json.loads(raw)
            if isinstance(origins, list):
                return [str(o).strip() for o in origins if str(o).strip()]
            if isinstance(origins, str):
                raw = origins.strip()
        except (json.JSONDecodeError, TypeError):
            pass

        # 2. Handle bracketed Python list syntax: ['http://...', '...']
        if raw.startswith("[") and raw.endswith("]"):
            raw = raw[1:-1]

        # 3. Fallback: split on comma and clean surrounding quotes/whitespace
        cleaned = [item.strip().strip("'\"") for item in raw.split(",") if item.strip().strip("'\"")]
        return cleaned or ["*"]

    @property
    def groq_configured(self) -> bool:
        if not self.GROQ_API_KEY:
            return False
        key = self.GROQ_API_KEY.strip()
        if not key or key.lower() in (
            "your_groq_api_key_here",
            "your_api_key_here",
            "placeholder",
            "none",
            "null",
        ):
            return False
        if key.startswith("your_") and key.endswith("_here"):
            return False
        return True

    @property
    def execution_configured(self) -> bool:
        # Check OnlineCompiler.io key
        if self.ONLINECOMPILER_API_KEY:
            key = self.ONLINECOMPILER_API_KEY.strip()
            if key and key.lower() not in (
                "placeholder", "none", "null", "your_onlinecompiler_api_key_here", "your_api_key_here"
            ) and not (key.startswith("your_") and key.endswith("_here")):
                return True
        # Backward-compatible check for Judge0 endpoint if set
        if self.JUDGE0_BASE_URL:
            url = self.JUDGE0_BASE_URL.strip()
            if url and url.lower() not in ("placeholder", "none", "null", "your_judge0_url_here") and not (url.startswith("your_") and url.endswith("_here")):
                return True
        return False

    @property
    def max_code_bytes(self) -> int:
        return self.MAX_CODE_SIZE_KB * 1024

    @property
    def max_output_bytes(self) -> int:
        return self.MAX_OUTPUT_SIZE_KB * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_env_files()
    s = Settings()
    if not s.groq_configured:
        logger.warning(
            "GROQ_API_KEY is not set or using placeholder – AI features will be unavailable. "
            "Set GROQ_API_KEY in your .env file to enable them."
        )
    if not s.execution_configured:
        logger.warning(
            "ONLINECOMPILER_API_KEY is not set or using placeholder – code execution will be unavailable. "
            "Set ONLINECOMPILER_API_KEY in your .env file to enable execution."
        )
    return s
