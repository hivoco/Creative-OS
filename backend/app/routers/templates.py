import json
import os
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_editor
from app.core.security import new_uuid
from app.models import Brand, LayerTranslation, Template, TemplateVersion, TextLayer
from app.schemas.template import TemplateDetailOut, TemplateOut, TemplateVersionOut
from app.services import s3, storage

router = APIRouter(prefix="/templates", tags=["templates"])

MAX_FILE_SIZE = 32 * 1024 * 1024


def _slugify(value: str) -> str:
    """Lowercase, dash-separated, URL/key-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "untitled"


def _store_blank(
    data: bytes, *, brand_slug: str, name: str, original_name: str, content_type: str
) -> str:
    """Persist a blank template image (S3 when configured, else local) under a
    brand-scoped, human-readable key and return its public URL.

    e.g. templates/<brand_slug>/<name_slug>-<short_uuid>.png
    """
    ext = os.path.splitext(original_name)[1].lower() or ".png"
    key = f"templates/{brand_slug}/{_slugify(name)}-{new_uuid()[:8]}{ext}"
    if s3.s3_enabled():
        return s3.upload_bytes(data=data, key=key, content_type=content_type or "image/png")
    return storage.save_bytes(data=data, key=key)


def _get_owned_template(db: Session, template_id: str, brand_id: str) -> Template:
    tpl = db.get(Template, template_id)
    if not tpl or tpl.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.get("", response_model=list[TemplateDetailOut])
def list_templates(
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(Template)
        .filter(Template.brand_id == current.brand_id, Template.status == "active")
        .order_by(Template.created_at.desc())
        .all()
    )


@router.get("/{template_id}", response_model=TemplateDetailOut)
def get_template(
    template_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_template(db, template_id, current.brand_id)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Delete a template and all its versions / layers / variants / reviews."""
    tpl = _get_owned_template(db, template_id, current.brand_id)
    db.delete(tpl)
    db.commit()


@router.post("", response_model=TemplateDetailOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    name: str = Form(...),
    category: str = Form("campaign"),
    dimensions_json: str = Form(...),  # JSON string: {"w":1080,"h":1080}
    blank_image: UploadFile = File(...),
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    content = await blank_image.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large (max 32MB)")
    if not blank_image.content_type or not blank_image.content_type.startswith("image"):
        raise HTTPException(status_code=400, detail="Invalid image file")

    try:
        dims = json.loads(dimensions_json)
        assert "w" in dims and "h" in dims
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dimensions_json")

    brand = db.get(Brand, current.brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    url = _store_blank(
        content,
        brand_slug=brand.slug,
        name=name,
        original_name=blank_image.filename or "blank.png",
        content_type=blank_image.content_type or "image/png",
    )

    tpl = Template(
        brand_id=current.brand_id,
        name=name,
        category=category,
        blank_image_url=url,
        dimensions_json=dims,
    )
    db.add(tpl)
    db.flush()

    # Every template starts with v1 draft.
    version = TemplateVersion(
        template_id=tpl.id,
        created_by=current.id,
        version_number=1,
        status="draft",
    )
    db.add(version)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.post(
    "/{template_id}/versions",
    response_model=TemplateVersionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_version(
    template_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    tpl = _get_owned_template(db, template_id, current.brand_id)
    latest = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == tpl.id)
        .order_by(TemplateVersion.version_number.desc())
        .first()
    )
    next_number = (latest.version_number + 1) if latest else 1
    version = TemplateVersion(
        template_id=tpl.id,
        created_by=current.id,
        version_number=next_number,
        status="draft",
    )
    db.add(version)
    db.flush()

    # Clone the latest version's layers + translations so the new draft starts
    # from the previous content instead of empty.
    if latest:
        for src_layer in latest.layers:
            new_layer = TextLayer(
                template_version_id=version.id,
                layer_key=src_layer.layer_key,
                x_percent=src_layer.x_percent,
                y_percent=src_layer.y_percent,
                width_percent=src_layer.width_percent,
                height_percent=src_layer.height_percent,
                font_family=src_layer.font_family,
                font_weight=src_layer.font_weight,
                italic=src_layer.italic,
                base_font_size=src_layer.base_font_size,
                line_height=src_layer.line_height,
                letter_spacing_pct=src_layer.letter_spacing_pct,
                text_align=src_layer.text_align,
                default_color=src_layer.default_color,
                default_bg_color=src_layer.default_bg_color,
            )
            db.add(new_layer)
            db.flush()
            for tr in src_layer.translations:
                db.add(
                    LayerTranslation(
                        layer_id=new_layer.id,
                        language_code=tr.language_code,
                        content_delta=tr.content_delta,
                        plain_text=tr.plain_text,
                        font_family_override=tr.font_family_override,
                        font_weight_override=tr.font_weight_override,
                        italic_override=tr.italic_override,
                        font_size_override=tr.font_size_override,
                        line_height_override=tr.line_height_override,
                        letter_spacing_override=tr.letter_spacing_override,
                        color_override=tr.color_override,
                        status="draft",
                    )
                )

    db.commit()
    db.refresh(version)
    return version
