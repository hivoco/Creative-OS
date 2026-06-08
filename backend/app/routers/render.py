import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_editor
from app.core.security import new_uuid
from app.models import Template, TemplateRatioVariant, TextLayer
from app.routers.layers import _owned_version
import logging

from app.schemas.ratio import RatioVariantOut, RatioVariantUpdate
from app.services import gemini, render, s3, segmind
from app.services.storage import local_path_for_url

logger = logging.getLogger(__name__)
router = APIRouter(tags=["render"])


def _public_input_url(blank_url: str) -> str | None:
    """Return a publicly fetchable URL for the blank, uploading to S3 if it is
    only stored locally (Segmind cannot reach localhost)."""
    if blank_url.startswith("http") and "/uploads/" not in blank_url and "localhost" not in blank_url:
        return blank_url  # already public (e.g. S3)
    path = local_path_for_url(blank_url)
    if not (path and path.exists() and s3.s3_enabled()):
        return None
    ext = path.suffix.lstrip(".") or "png"
    url = s3.upload_bytes(
        data=path.read_bytes(),
        key=f"blanks/{path.name}",
        content_type=f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}",
    )
    return url


def _smart_resize_blank(blank_url: str, ratio: str) -> str | None:
    """Run Segmind nano-banana-pro to recompose the blank for `ratio`. Returns
    the resized blank's URL, or None on any failure (render falls back to
    Pillow-stretching the original)."""
    if not (segmind.is_live() and s3.s3_enabled()):
        return None
    try:
        input_url = _public_input_url(blank_url)
        if not input_url:
            return None
        data = segmind.smart_resize(
            image_url=input_url, aspect_ratio=ratio, output_format="jpg"
        )
        from app.core.security import new_uuid

        return s3.upload_bytes(
            data=data,
            key=f"variants/{new_uuid()}.jpg",
            content_type="image/jpeg",
        )
    except Exception as e:  # noqa: BLE001 — resize is best-effort
        logger.warning("smart-resize failed for ratio %s: %s", ratio, e)
        return None


def _ai_reshape(data: bytes, ratio: str, target_dims: dict) -> tuple[bytes, str, str]:
    """Reshape a finished composite to a new aspect ratio.

    Preferred: Segmind nano-banana-pro generative RECOMPOSE — re-lays-out the
    existing elements (subject, text, logo, CTA) to fill the new frame, instead
    of trapping the original in a padded band, while keeping each element's
    identity intact. Output is 2K PNG: 2K keeps the invented pixels sharp enough
    while staying fast/cheap to generate (Segmind silently downgrades anything
    but an uppercase "K", so "2K" not "2k"), PNG so hard-edged graphics, logos
    and text don't pick up JPEG ringing. Falls back to the Pillow blurred-extend
    (JPEG) when Segmind/S3 aren't available or the call fails, so a resize always
    produces *something*. Returns (image_bytes, source_tag, fmt)."""
    if segmind.is_live() and s3.s3_enabled():
        try:
            input_url = s3.upload_bytes(
                data=data,
                key=f"composites/{new_uuid()}.png",
                content_type="image/png",
            )
            out = segmind.recompose_composite(
                image_url=input_url,
                aspect_ratio=ratio,
                output_resolution="2K",
                output_format="png",
            )
            return out, "ai_resized", "png"
        except Exception as e:  # noqa: BLE001 — best-effort; fall back to blur
            logger.warning("AI reshape failed for ratio %s, using blur: %s", ratio, e)
    return render.extend_canvas(data, target_dims), "extended", "jpeg"


def _layers_payload(db: Session, version_id: str) -> list[dict]:
    layers = (
        db.query(TextLayer)
        .filter(TextLayer.template_version_id == version_id)
        .all()
    )
    payload = []
    for layer in layers:
        payload.append(
            {
                "layer_key": layer.layer_key,
                "x_percent": layer.x_percent,
                "y_percent": layer.y_percent,
                "width_percent": layer.width_percent,
                "height_percent": layer.height_percent,
                "font_family": layer.font_family,
                "font_weight": layer.font_weight,
                "italic": layer.italic,
                "base_font_size": layer.base_font_size,
                "line_height": layer.line_height,
                "letter_spacing_pct": layer.letter_spacing_pct,
                "text_align": layer.text_align,
                "default_color": layer.default_color,
                "default_bg_color": layer.default_bg_color,
                "translations": [
                    {
                        "language_code": t.language_code,
                        "content_delta": t.content_delta,
                        "font_family_override": t.font_family_override,
                        "font_weight_override": t.font_weight_override,
                        "italic_override": t.italic_override,
                        "font_size_override": t.font_size_override,
                        "line_height_override": t.line_height_override,
                        "letter_spacing_override": t.letter_spacing_override,
                        "color_override": t.color_override,
                        "x_percent_override": t.x_percent_override,
                        "y_percent_override": t.y_percent_override,
                        "width_percent_override": t.width_percent_override,
                        "height_percent_override": t.height_percent_override,
                    }
                    for t in layer.translations
                ],
            }
        )
    return payload


@router.get("/versions/{version_id}/render")
def render_version(
    version_id: str,
    language: str = Query("en"),
    ratio: str | None = Query(None),
    fmt: str = Query("png"),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    tpl = db.get(Template, version.template_id)

    target_dims = tpl.dimensions_json
    positions = None
    blank_url = tpl.blank_image_url
    if ratio:
        variant = (
            db.query(TemplateRatioVariant)
            .filter(
                TemplateRatioVariant.template_version_id == version.id,
                TemplateRatioVariant.ratio == ratio,
            )
            .first()
        )
        if not variant:
            raise HTTPException(status_code=404, detail="Ratio variant not found")
        # Baked variant = the finished extended design; serve it directly.
        if variant.text_baked and variant.blank_image_url:
            try:
                img = render._load_blank(variant.blank_image_url)
            except FileNotFoundError as e:
                raise HTTPException(status_code=404, detail=str(e))
            import io as _io

            out_fmt = "JPEG" if fmt.lower() in ("jpg", "jpeg") else "PNG"
            buf = _io.BytesIO()
            (img.convert("RGB") if out_fmt == "JPEG" else img).save(buf, format=out_fmt)
            media = "image/jpeg" if out_fmt == "JPEG" else "image/png"
            return Response(content=buf.getvalue(), media_type=media)
        target_dims = variant.dimensions_json
        positions = variant.layers_json
        if variant.blank_image_url:
            blank_url = variant.blank_image_url

    try:
        image_bytes = render.render_template(
            blank_image_url=blank_url,
            target_dims=target_dims,
            layers=_layers_payload(db, version.id),
            positions=positions,
            language_code=language,
            output_format=fmt,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    media = "image/jpeg" if fmt.lower() in ("jpg", "jpeg") else "image/png"
    return Response(content=image_bytes, media_type=media)


@router.get("/versions/{version_id}/blank-image")
def get_blank_image(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Serve the version's blank image through our API (which sends CORS headers)
    so the browser can draw it onto a canvas and read it back. Fetching the S3
    URL directly would taint the canvas — S3 buckets aren't CORS-configured."""
    version = _owned_version(db, version_id, current.brand_id)
    tpl = db.get(Template, version.template_id)
    try:
        img = render._load_blank(tpl.blank_image_url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


class RatioSuggestRequest(BaseModel):
    ratio: str
    target_dims: dict  # {"w":1080,"h":1920}
    language: str = "en"  # which language's text to bake into the resize


@router.get(
    "/versions/{version_id}/ratio-variants", response_model=list[RatioVariantOut]
)
def list_ratio_variants(
    version_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = _owned_version(db, version_id, current.brand_id)
    return (
        db.query(TemplateRatioVariant)
        .filter(TemplateRatioVariant.template_version_id == version.id)
        .order_by(TemplateRatioVariant.created_at.desc())
        .all()
    )


@router.patch("/ratio-variants/{variant_id}", response_model=RatioVariantOut)
def update_ratio_variant(
    variant_id: str,
    payload: RatioVariantUpdate,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    variant = db.get(TemplateRatioVariant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    _owned_version(db, variant.template_version_id, current.brand_id)

    if payload.layers_json is not None:
        variant.layers_json = payload.layers_json
        if variant.source == "llm_suggested":
            variant.source = "manually_adjusted"
    if payload.status is not None:
        if payload.status not in ("draft", "published"):
            raise HTTPException(status_code=400, detail="Invalid status")
        variant.status = payload.status
    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/ratio-variants/{variant_id}", status_code=204)
def delete_ratio_variant(
    variant_id: str,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    variant = db.get(TemplateRatioVariant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    _owned_version(db, variant.template_version_id, current.brand_id)
    db.delete(variant)
    db.commit()


@router.post(
    "/versions/{version_id}/ratio-variants", response_model=RatioVariantOut
)
def create_ratio_variant(
    version_id: str,
    req: RatioSuggestRequest,
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Resize the FINISHED design to a new ratio by extending the canvas.

    The user edits the whole template first, then resizes. We render the current
    composite (blank + text in the chosen language), extend it to the target
    ratio (no stretch — text stays exactly where it was placed), and store that
    finished image. No per-ratio text coordinates are kept.
    """
    version = _owned_version(db, version_id, current.brand_id)
    tpl = db.get(Template, version.template_id)

    try:
        composite = render.render_template(
            blank_image_url=tpl.blank_image_url,
            target_dims=tpl.dimensions_json,
            layers=_layers_payload(db, version.id),
            positions=None,
            language_code=req.language,
            output_format="png",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    reshaped, source, fmt = _ai_reshape(composite, req.ratio, req.target_dims)
    url = _store_resized(reshaped, version.id, req.ratio, fmt)

    variant = TemplateRatioVariant(
        template_version_id=version.id,
        ratio=req.ratio,
        dimensions_json=req.target_dims,
        layers_json={},
        blank_image_url=url,
        text_baked=True,
        source=source,
        status="draft",
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.post(
    "/versions/{version_id}/ratio-variants/from-composite",
    response_model=RatioVariantOut,
)
def create_ratio_variant_from_composite(
    version_id: str,
    ratio: str = Form(...),
    target_w: int = Form(...),
    target_h: int = Form(...),
    composite: UploadFile = File(...),
    current: CurrentUser = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """Resize a CLIENT-rendered composite to a new ratio by extending the canvas.

    The browser bakes the design (blank + wrapped text) into a bitmap that
    matches the editor exactly and uploads it here; we only reshape it (no
    stretch), so the result never diverges from what the user saw on the canvas.
    """
    version = _owned_version(db, version_id, current.brand_id)
    data = composite.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty composite upload")

    target_dims = {"w": int(target_w), "h": int(target_h)}
    reshaped, source, fmt = _ai_reshape(data, ratio, target_dims)
    url = _store_resized(reshaped, version.id, ratio, fmt)

    variant = TemplateRatioVariant(
        template_version_id=version.id,
        ratio=ratio,
        dimensions_json=target_dims,
        layers_json={},
        blank_image_url=url,
        text_baked=True,
        source=source,
        status="draft",
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


def _store_resized(data: bytes, version_id: str, ratio: str, fmt: str = "jpeg") -> str:
    safe = ratio.replace(":", "x")
    ext = "png" if fmt == "png" else "jpg"
    content_type = "image/png" if fmt == "png" else "image/jpeg"
    key = f"ratios/{version_id}/{safe}-{new_uuid()}.{ext}"
    if s3.s3_enabled():
        return s3.upload_bytes(data=data, key=key, content_type=content_type)
    from app.services import storage

    return storage.save_bytes(data=data, key=key)
