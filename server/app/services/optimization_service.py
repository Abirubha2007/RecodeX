"""
Optimization service – delegates to Groq for candidate generation.
"""

from app.schemas import OptimizationResult
from app.services import groq_service


def generate_optimization(language: str, source_code: str, context: str | None = None) -> OptimizationResult:
    return groq_service.suggest_optimization(language, source_code, context)
