"""Languages endpoint."""

from fastapi import APIRouter
from app.schemas import Language, LanguagesResponse
from app.services.execution_service import LANGUAGE_MAP

router = APIRouter(tags=["languages"])

_LANGUAGE_META = {
    "python":     {"name": "Python",     "version": "3.8"},
    "c":          {"name": "C",          "version": "GCC 9.2"},
    "cpp":        {"name": "C++",        "version": "GCC 9.2"},
    "javascript": {"name": "JavaScript", "version": "Node.js 12"},
    "java":       {"name": "Java",       "version": "OpenJDK 13"},
    "go":         {"name": "Go",         "version": "1.13"},
    "rust":       {"name": "Rust",       "version": "1.40"},
    "typescript": {"name": "TypeScript", "version": "3.7"},
}


@router.get("/languages", response_model=LanguagesResponse)
def get_languages():
    languages = [
        Language(
            id=lang_id,
            name=_LANGUAGE_META.get(lang_id, {}).get("name", lang_id.capitalize()),
            version=_LANGUAGE_META.get(lang_id, {}).get("version"),
            judge0_id=judge0_id,
        )
        for lang_id, judge0_id in LANGUAGE_MAP.items()
    ]
    return LanguagesResponse(languages=languages)
