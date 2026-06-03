from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_editor
from app.models import LayerTranslation, Template, TemplateVersion, TextLayer
from app.schemas.layer import (
    LayerTranslationOut,
    LayerTranslationUpsert,
    TextLayerCreate,
    TextLayerOut,
    TextLayerUpdate,
)
from app.schemas.template import TemplateOut, TemplateVersionOut
from app.services.render import delta_to_plain_text

router = APIRouter(tags=["layers"])


def _owned_version(db: Session, version_id: str, brand_id: str) -> TemplateVersion:
    version = db.get(TemplateVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    tpl = db.get(Template, version.template_id)
    if not tpl or tpl.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


def _owned_layer(db: Session, layer_id: str, brand_id: str) -> TextLayer:
    layer = db.get(TextLayer, layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    _owned_version(db, layer.template_version_id, brand_id)
    return layer


def _assert_editable(version: TemplateVersion) -> None:
    if version.status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Version is {version.status} and locked for editing",
        )


# ---- Version context ------------------------------------------------------


@router.get("/versions/{version_id}")
def get_version_context(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Everything the editor needs to render: version status + parent template."""
    version = _owned_version(db, version_id, current.brand_id)
    tpl = db.get(Template, version.template_id)
    return {
        "version": TemplateVersionOut.model_validate(version),
        "template": TemplateOut.model_validate(tpl),
    }


@router.delete("/versions/{version_id}", status_code=204)
def delete_version(
    version_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Delete a version and everything under it (layers, translations, ratio
    variants, reviews) via ORM cascade."""
    version = _owned_version(db, version_id, current.brand_id)
    db.delete(version)
    db.commit()


# ---- Layers ---------------------------------------------------------------


@router.get("/versions/{version_id}/layers", response_model=list[TextLayerOut])
def list_layers(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    return (
        db.query(TextLayer)
        .filter(TextLayer.template_version_id == version.id)
        .all()
    )


@router.post("/versions/{version_id}/layers", response_model=TextLayerOut, status_code=201)
def create_layer(
    version_id: str,
    payload: TextLayerCreate,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    _assert_editable(version)
    layer = TextLayer(template_version_id=version.id, **payload.model_dump())
    db.add(layer)
    db.commit()
    db.refresh(layer)
    return layer


@router.patch("/layers/{layer_id}", response_model=TextLayerOut)
def update_layer(
    layer_id: str,
    payload: TextLayerUpdate,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    layer = _owned_layer(db, layer_id, current.brand_id)
    _assert_editable(layer.version)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(layer, field, value)
    db.commit()
    db.refresh(layer)
    return layer


@router.delete("/layers/{layer_id}", status_code=204)
def delete_layer(
    layer_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    layer = _owned_layer(db, layer_id, current.brand_id)
    _assert_editable(layer.version)
    db.delete(layer)
    db.commit()


# ---- Layer translations (auto-save target) --------------------------------


@router.put(
    "/layers/{layer_id}/translations/{language_code}",
    response_model=LayerTranslationOut,
)
def upsert_translation(
    layer_id: str,
    language_code: str,
    payload: LayerTranslationUpsert,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Debounced auto-save endpoint. Creates or updates the language row."""
    layer = _owned_layer(db, layer_id, current.brand_id)
    _assert_editable(layer.version)

    row = (
        db.query(LayerTranslation)
        .filter(
            LayerTranslation.layer_id == layer.id,
            LayerTranslation.language_code == language_code,
        )
        .first()
    )
    plain = payload.plain_text or delta_to_plain_text(payload.content_delta)
    overrides = dict(
        font_family_override=payload.font_family_override,
        font_weight_override=payload.font_weight_override,
        italic_override=payload.italic_override,
        font_size_override=payload.font_size_override,
        line_height_override=payload.line_height_override,
        letter_spacing_override=payload.letter_spacing_override,
        color_override=payload.color_override,
    )
    if row is None:
        row = LayerTranslation(
            layer_id=layer.id,
            language_code=language_code,
            content_delta=payload.content_delta,
            plain_text=plain,
            status=payload.status or "draft",
            **overrides,
        )
        db.add(row)
    else:
        row.content_delta = payload.content_delta
        row.plain_text = plain
        for field, value in overrides.items():
            setattr(row, field, value)
        if payload.status:
            row.status = payload.status
    db.commit()
    db.refresh(row)
    return row
