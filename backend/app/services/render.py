"""Server-side compositing of blank template + text layers using Pillow.

Implements the render pipeline from reference.md §11 with per-language fonts,
the style cascade, and inline Quill Delta formatting (per-run bold / italic /
color), so the exported image matches the editor preview.
"""

import io
from pathlib import Path

from PIL import Image, ImageDraw

from app.services import fonts
from app.services.storage import local_path_for_url


def delta_to_plain_text(delta: dict) -> str:
    if not delta or "ops" not in delta:
        return ""
    return "".join(
        op.get("insert", "") for op in delta["ops"] if isinstance(op.get("insert"), str)
    ).strip()


def delta_to_lines(delta: dict) -> list[list[dict]]:
    """Split a Delta into lines of styled runs: [{text, bold, italic, color}]."""
    lines: list[list[dict]] = [[]]
    for op in (delta or {}).get("ops", []):
        ins = op.get("insert")
        if not isinstance(ins, str):
            continue
        attrs = op.get("attributes") or {}
        run = {
            "bold": bool(attrs.get("bold")),
            "italic": bool(attrs.get("italic")),
            "color": attrs.get("color"),
        }
        parts = ins.split("\n")
        for i, part in enumerate(parts):
            if part:
                lines[-1].append({**run, "text": part})
            if i < len(parts) - 1:
                lines.append([])
    while len(lines) > 1 and not lines[-1]:
        lines.pop()
    return lines


def _load_blank(blank_image_url: str) -> Image.Image:
    path = local_path_for_url(blank_image_url)
    if path and Path(path).exists():
        return Image.open(path).convert("RGBA")
    # Remote (e.g. S3) blank — download it.
    if blank_image_url.startswith("http"):
        import requests

        resp = requests.get(blank_image_url, timeout=60)
        if resp.ok and resp.content:
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    raise FileNotFoundError(f"Blank image not found for url: {blank_image_url}")


def _resolve(layer: dict, t: dict | None, key: str, override_key: str, default):
    if t and t.get(override_key) is not None:
        return t[override_key]
    return layer.get(key, default)


def _anchor_x(align: str, x_pct: float, tw: int) -> tuple[float, str]:
    x = (x_pct / 100.0) * tw
    return x, {"left": "l", "center": "m", "right": "r"}.get(align, "l")


def render_template(
    *,
    blank_image_url: str,
    target_dims: dict,
    layers: list[dict],
    positions: dict | None = None,
    language_code: str = "en",
    output_format: str = "png",
) -> bytes:
    base = _load_blank(blank_image_url)
    tw, th = int(target_dims["w"]), int(target_dims["h"])
    base = base.resize((tw, th))
    draw = ImageDraw.Draw(base)

    rtl = fonts.is_rtl(language_code)

    for layer in layers:
        key = layer["layer_key"]
        pos = (positions or {}).get(key)

        translations = layer.get("translations", [])
        t = next(
            (tr for tr in translations if tr["language_code"] == language_code),
            None,
        )
        # The requested language may have no copy yet — fall back to any
        # translation that actually has text so the render isn't blank.
        if t is None or not delta_to_plain_text(t.get("content_delta")):
            t = next(
                (tr for tr in translations if delta_to_plain_text(tr.get("content_delta"))),
                t,
            )
        delta = t["content_delta"] if t else None
        if not delta_to_plain_text(delta):
            continue

        # Ratio-variant position wins; otherwise use the language's own override,
        # falling back to the layer's base coordinate.
        x_pct = pos["x"] if pos else _resolve(layer, t, "x_percent", "x_percent_override", 0)
        y_pct = pos["y"] if pos else _resolve(layer, t, "y_percent", "y_percent_override", 0)
        size = int(
            (pos and pos.get("font"))
            or _resolve(layer, t, "base_font_size", "font_size_override", 32)
        )
        base_color = _resolve(layer, t, "default_color", "color_override", "#FFFFFF")
        base_weight = int(_resolve(layer, t, "font_weight", "font_weight_override", 400))
        line_height = float(
            _resolve(layer, t, "line_height", "line_height_override", 1.15)
        )

        align = layer.get("text_align", "left")
        x, h_anchor = _anchor_x(align, x_pct, tw)
        y = (y_pct / 100.0) * th
        line_step = size * line_height

        if rtl:
            lines = [
                [{"text": fonts.shape_text(_plain_line(line), language_code),
                  "bold": False, "italic": False, "color": None}]
                for line in delta_to_lines(delta)
            ]
        else:
            lines = delta_to_lines(delta)

        def font_for(run: dict):
            weight = 700 if run["bold"] else base_weight
            return fonts.get_font(language_code, size=size, weight=weight)

        # Optional background scrim sized to the widest line.
        bg = layer.get("default_bg_color")
        if bg:
            widths = [
                sum(draw.textlength(r["text"], font=font_for(r)) for r in line)
                for line in lines
            ]
            box_w = max(widths) if widths else 0
            left = x - box_w / 2 if h_anchor == "m" else (x - box_w if h_anchor == "r" else x)
            pad = max(6, size * 0.12)
            draw.rectangle(
                [left - pad, y - pad, left + box_w + pad, y + line_step * len(lines) + pad],
                fill=_hex_to_rgba(bg),
            )

        for i, line in enumerate(lines):
            ly = y + i * line_step
            total = sum(draw.textlength(r["text"], font=font_for(r)) for r in line)
            cursor = x - total / 2 if h_anchor == "m" else (x - total if h_anchor == "r" else x)
            for run in line:
                font = font_for(run)
                color = run["color"] or base_color
                draw.text((cursor, ly), run["text"], font=font, fill=color, anchor="la")
                cursor += draw.textlength(run["text"], font=font)

    buf = io.BytesIO()
    fmt = "JPEG" if output_format.lower() in ("jpg", "jpeg") else "PNG"
    out = base.convert("RGB") if fmt == "JPEG" else base
    out.save(buf, format=fmt)
    return buf.getvalue()


def _plain_line(line: list[dict]) -> str:
    return "".join(r["text"] for r in line)


def extend_canvas(composite_bytes: bytes, target_dims: dict) -> bytes:
    """Reshape a finished composite to a new aspect ratio by EXTENDING the
    canvas — never stretching. The original (image + text) is uniformly scaled
    to fit the new frame and centered; the added area is filled with a blurred,
    zoomed copy of the design so text/content keep their exact relative place.
    """
    from PIL import ImageFilter

    orig = Image.open(io.BytesIO(composite_bytes)).convert("RGB")
    w0, h0 = orig.size
    tw, th = int(target_dims["w"]), int(target_dims["h"])

    # Contain: largest size that fits the target without distortion.
    fit = min(tw / w0, th / h0)
    sw, sh = max(1, int(w0 * fit)), max(1, int(h0 * fit))
    scaled = orig.resize((sw, sh), Image.LANCZOS)

    # Background: cover the frame with a blurred, darkened copy of the design.
    cover = max(tw / w0, th / h0)
    cw, ch = max(1, int(w0 * cover)), max(1, int(h0 * cover))
    bg = orig.resize((cw, ch), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
    left, top = (cw - tw) // 2, (ch - th) // 2
    bg = bg.crop((left, top, left + tw, top + th))
    bg = Image.blend(bg, Image.new("RGB", (tw, th), (0, 0, 0)), 0.25)

    bg.paste(scaled, ((tw - sw) // 2, (th - sh) // 2))

    buf = io.BytesIO()
    bg.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _hex_to_rgba(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    if len(value) == 8:
        r, g, b, a = (int(value[i : i + 2], 16) for i in (0, 2, 4, 6))
        return (r, g, b, a)
    if len(value) == 6:
        r, g, b = (int(value[i : i + 2], 16) for i in (0, 2, 4))
        return (r, g, b, 255)
    return (0, 0, 0, 102)
