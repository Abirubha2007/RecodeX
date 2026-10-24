"""Languages endpoint."""

from fastapi import APIRouter
from app.schemas import Language, LanguagesResponse
from app.services.execution_service import LANGUAGE_MAP, LEGACY_JUDGE0_MAP

router = APIRouter(tags=["languages"])

_LANGUAGE_META = {
    "python":     {"name": "Python",     "version": "3.14"},
    "c":          {"name": "C",          "version": "GCC 15"},
    "cpp":        {"name": "C++",        "version": "G++ 15"},
    "javascript": {"name": "JavaScript", "version": "Node.js 24"},
    "typescript": {"name": "TypeScript", "version": "Deno 2"},
    "java":       {"name": "Java",       "version": "OpenJDK 25"},
    "go":         {"name": "Go",         "version": "1.26"},
    "rust":       {"name": "Rust",       "version": "1.93"},
}


@router.get("/languages", response_model=LanguagesResponse)
def get_languages():
    languages = [
        Language(
            id=lang_id,
            name=_LANGUAGE_META.get(lang_id, {}).get("name", lang_id.capitalize()),
            version=_LANGUAGE_META.get(lang_id, {}).get("version"),
            compiler_id=compiler_id,
            judge0_id=LEGACY_JUDGE0_MAP.get(lang_id),
        )
        for lang_id, compiler_id in LANGUAGE_MAP.items()
    ]
    return LanguagesResponse(languages=languages)
