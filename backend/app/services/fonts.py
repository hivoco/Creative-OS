"""Per-language font resolution for the render pipeline (reference.md §11).

Maps a language code to the right Noto font so non-Latin scripts (Devanagari,
Tamil, Arabic, …) render correctly in exported images instead of tofu boxes.
Run download_fonts.py once to populate ./fonts.
"""

from functools import lru_cache
from pathlib import Path

from PIL import ImageFont

FONT_DIR = Path(__file__).resolve().parent.parent.parent / "fonts"

# language_code -> Noto family stem
LANG_FAMILY: dict[str, str] = {
    "en": "NotoSans",
    "fr": "NotoSans",
    "es": "NotoSans",
    "hi": "NotoSansDevanagari",
    "mr": "NotoSansDevanagari",
    "ne": "NotoSansDevanagari",
    "bn": "NotoSansBengali",
    "ta": "NotoSansTamil",
    "te": "NotoSansTelugu",
    "kn": "NotoSansKannada",
    "ml": "NotoSansMalayalam",
    "gu": "NotoSansGujarati",
    "pa": "NotoSansGurmukhi",
    "or": "NotoSansOriya",
    "ar": "NotoSansArabic",
    "ur": "NotoSansArabic",
}

RTL_LANGUAGES = {"ar", "ur", "fa", "he"}

DEFAULT_FAMILY = "NotoSans"


def is_rtl(language_code: str) -> bool:
    return language_code in RTL_LANGUAGES


def _font_path(family: str, bold: bool) -> Path | None:
    style = "Bold" if bold else "Regular"
    path = FONT_DIR / f"{family}-{style}.ttf"
    if path.exists():
        return path
    # Fall back to Regular if a Bold file is missing.
    reg = FONT_DIR / f"{family}-Regular.ttf"
    return reg if reg.exists() else None


@lru_cache(maxsize=256)
def _load(family: str, size: int, bold: bool) -> ImageFont.FreeTypeFont:
    path = _font_path(family, bold)
    if path is None:
        # Last-resort fallback so render never crashes.
        try:
            return ImageFont.truetype("DejaVuSans.ttf", size=size)
        except Exception:
            return ImageFont.load_default()
    return ImageFont.truetype(str(path), size=size)


def get_font(
    language_code: str, *, size: int, weight: int = 400, italic: bool = False
) -> ImageFont.FreeTypeFont:
    """Return a Pillow font for the language. Weight >= 600 uses the Bold file.

    (Static Noto Sans has no italic file; italic is ignored for export.)
    """
    family = LANG_FAMILY.get(language_code, DEFAULT_FAMILY)
    return _load(family, max(8, int(size)), weight >= 600)


def shape_text(text: str, language_code: str) -> str:
    """Reshape + bidi-reorder RTL text (Arabic/Urdu) for correct rendering."""
    if not is_rtl(language_code):
        return text
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return get_display(arabic_reshaper.reshape(text))
    except Exception:
        return text
