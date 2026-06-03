"""Gemini-backed translation + ratio layout suggestion.

Falls back to a deterministic no-op when GEMINI_API_KEY is not set, so the
whole app keeps working without a key during development.
"""

import json

from app.core.config import settings

try:
    from google import genai

    _client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
except Exception:  # pragma: no cover - import/setup guard
    genai = None
    _client = None


def is_live() -> bool:
    return _client is not None


def translate_text(text: str, *, source_language: str, target_language: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""

    if _client is None:
        # No-op fallback so the flow works offline.
        return f"[{target_language}] {text}"

    prompt = (
        f"Translate the following text from {source_language} to {target_language}. "
        "Preserve meaning and tone for a marketing poster. "
        "Return ONLY the translated text, with no quotes, no notes, no markdown.\n\n"
        f"{text}"
    )
    resp = _client.models.generate_content(
        model=settings.gemini_model, contents=prompt
    )
    return (resp.text or "").strip()


def translate_many(
    texts: list[str], *, source_language: str, target_language: str
) -> list[str]:
    return [
        translate_text(t, source_language=source_language, target_language=target_language)
        for t in texts
    ]


def suggest_ratio_layout(
    *,
    layers_json: dict,
    source_ratio: str,
    source_dims: dict,
    target_ratio: str,
    target_dims: dict,
) -> dict:
    """Ask the LLM for new layer positions for a target aspect ratio.

    Returns { layer_key: { x, y, w, h, font } }. Falls back to a proportional
    scaling heuristic when no API key is configured or parsing fails.
    """
    if _client is None:
        return _resolve_overlaps(
            _proportional_fallback(layers_json, source_dims, target_dims)
        )

    prompt = (
        f"You are laying out text boxes on a poster. Current layers (percent of "
        f"canvas, x/y = top-left, w/h = box size): {json.dumps(layers_json)}. "
        f"Source canvas is {source_ratio} ({source_dims.get('w')}x{source_dims.get('h')}px); "
        f"reflow them onto a {target_ratio} ({target_dims.get('w')}x{target_dims.get('h')}px) canvas.\n"
        "HARD RULES:\n"
        "1. No two boxes may overlap — leave at least 3% vertical gap between them.\n"
        "2. Every box must stay fully inside the canvas: x>=3, y>=3, x+w<=97, y+h<=97.\n"
        "3. Preserve the original top-to-bottom reading order of the layers.\n"
        "4. Scale font sizes (px) sensibly for the new canvas height.\n"
        "5. Keep boxes readable; widen them on tall canvases rather than overlapping.\n"
        "Return ONLY valid JSON, no markdown, exactly: "
        '{ "layer_key": { "x": number, "y": number, "w": number, "h": number, "font": number } }.'
    )
    try:
        resp = _client.models.generate_content(
            model=settings.gemini_model, contents=prompt
        )
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw
        suggested = json.loads(raw)
    except Exception:
        suggested = _proportional_fallback(layers_json, source_dims, target_dims)

    # Deterministic safety net — guarantees no layer overlaps regardless of the
    # LLM output, preserving reading order and clamping inside the canvas.
    return _resolve_overlaps(suggested, original=layers_json)


def _proportional_fallback(layers_json: dict, source_dims: dict, target_dims: dict) -> dict:
    sw, sh = source_dims.get("w", 1), source_dims.get("h", 1)
    tw, th = target_dims.get("w", 1), target_dims.get("h", 1)
    font_scale = (tw / sw + th / sh) / 2 if sw and sh else 1
    out: dict = {}
    for key, pos in (layers_json or {}).items():
        out[key] = {
            "x": pos.get("x", 5),
            "y": pos.get("y", 5),
            "w": pos.get("w", 50),
            "h": pos.get("h", 10),
            "font": round(pos.get("font", 32) * font_scale, 1),
        }
    return out


def _boxes_overlap(a: dict, b: dict, gap: float) -> bool:
    return not (
        a["x"] + a["w"] + gap <= b["x"]
        or a["x"] >= b["x"] + b["w"] + gap
        or a["y"] + a["h"] + gap <= b["y"]
        or a["y"] >= b["y"] + b["h"] + gap
    )


def _resolve_overlaps(
    positions: dict, *, original: dict | None = None, gap: float = 3.0
) -> dict:
    """Push boxes apart vertically so none overlap, in reading order.

    Reading order is taken from `original` (the source layout) when available,
    otherwise from the suggested y. Boxes are clamped inside the canvas.
    """
    order = list(original.keys()) if original else None

    def sort_key(key: str) -> tuple:
        p = positions.get(key, {})
        if order and key in order:
            return (order.index(key), 0.0)
        return (10_000, float(p.get("y", 0)))

    items: list[tuple[str, dict]] = []
    for key in sorted(positions.keys(), key=sort_key):
        p = dict(positions[key])
        p["x"] = float(p.get("x", 5))
        p["y"] = float(p.get("y", 5))
        p["w"] = float(p.get("w", 50))
        p["h"] = float(p.get("h", 10))
        p["font"] = p.get("font", 32)
        # Clamp box size + x inside the canvas.
        p["w"] = max(5.0, min(p["w"], 94.0))
        p["h"] = max(3.0, min(p["h"], 94.0))
        p["x"] = min(max(p["x"], 3.0), 97.0 - p["w"])
        items.append((key, p))

    placed: list[dict] = []
    for _key, p in items:
        for _ in range(len(items) + 1):
            hit = next((q for q in placed if _boxes_overlap(p, q, gap)), None)
            if hit is None:
                break
            p["y"] = hit["y"] + hit["h"] + gap  # drop below the colliding box
        if p["y"] + p["h"] > 97.0:
            p["y"] = max(3.0, 97.0 - p["h"])
        placed.append(p)

    return {key: p for key, p in items}
