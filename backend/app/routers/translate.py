from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, require_editor
from app.models import LayerTranslation, TextLayer
from app.routers.layers import _assert_editable, _owned_version
from app.schemas.layer import LayerTranslationOut
from app.services import gemini
from app.services.render import delta_to_plain_text

router = APIRouter(tags=["translate"])

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "gu": "Gujarati",
    "mr": "Marathi",
    " kn": "Kannada",
    "ar": "Arabic",
    "fr": "French",
    "es": "Spanish",
}


class TranslateTextRequest(BaseModel):
    texts: list[str]
    source_language: str = "English"
    target_language: str = "Hindi"


class TranslateTextResponse(BaseModel):
    translations: list[str]


@router.post("/translate", response_model=TranslateTextResponse)
def translate_text(req: TranslateTextRequest):
    """Stateless translation helper (parity with the existing iifl service)."""
    result = gemini.translate_many(
        req.texts,
        source_language=req.source_language,
        target_language=req.target_language,
    )
    return TranslateTextResponse(translations=result)


def _reapply_formatting(source_delta: dict, translated: str) -> dict:
    """Re-apply the source's inline formatting to the translated text (§6).

    A full word-by-word re-map is unreliable across languages, so we carry the
    attributes that are uniform across all source runs (e.g. a headline that is
    entirely bold + colored stays bold + colored). Mixed formatting degrades to
    plain text, which is safe.
    """
    runs = [
        op
        for op in (source_delta or {}).get("ops", [])
        if isinstance(op.get("insert"), str) and op["insert"].strip()
    ]
    attrs: dict = {}
    if runs:
        for k in ("bold", "italic", "color"):
            values = {r.get("attributes", {}).get(k) for r in runs}
            if len(values) == 1 and next(iter(values)) not in (None, False):
                attrs[k] = next(iter(values))
    op = {"insert": translated + "\n"}
    if attrs:
        op["attributes"] = attrs
    return {"ops": [op]}


class TranslateVersionRequest(BaseModel):
    target_language: str  # ISO code, e.g. "hi"
    source_language: str = "en"


@router.post(
    "/versions/{version_id}/translate", response_model=list[LayerTranslationOut]
)
def translate_version(
    version_id: str,
    req: TranslateVersionRequest,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Translate every layer's source-language text into the target language.

    Plain text only goes to the LLM; we wrap the result back into a Delta.
    """
    version = _owned_version(db, version_id, current.brand_id)
    _assert_editable(version)

    src_name = LANGUAGE_NAMES.get(req.source_language, req.source_language)
    tgt_name = LANGUAGE_NAMES.get(req.target_language, req.target_language)

    layers = (
        db.query(TextLayer)
        .filter(TextLayer.template_version_id == version.id)
        .all()
    )

    out: list[LayerTranslation] = []
    for layer in layers:
        source = next(
            (
                t
                for t in layer.translations
                if t.language_code == req.source_language
            ),
            None,
        )
        if not source:
            continue
        plain = source.plain_text or delta_to_plain_text(source.content_delta)
        if not plain:
            continue

        translated = gemini.translate_text(
            plain, source_language=src_name, target_language=tgt_name
        )
        delta = _reapply_formatting(source.content_delta, translated)

        row = next(
            (
                t
                for t in layer.translations
                if t.language_code == req.target_language
            ),
            None,
        )
        if row is None:
            # Seed the target with the source language's style so it starts from
            # the same look, then the editor can tweak it independently.
            row = LayerTranslation(
                layer_id=layer.id,
                language_code=req.target_language,
                content_delta=delta,
                plain_text=translated,
                status="translated",
                font_family_override=source.font_family_override,
                font_weight_override=source.font_weight_override,
                italic_override=source.italic_override,
                font_size_override=source.font_size_override,
                line_height_override=source.line_height_override,
                letter_spacing_override=source.letter_spacing_override,
                color_override=source.color_override,
            )
            db.add(row)
        else:
            row.content_delta = delta
            row.plain_text = translated
            row.status = "translated"
        db.flush()
        out.append(row)

    db.commit()
    for row in out:
        db.refresh(row)
    return out
