"""Segmind nano-banana-pro AI smart-resize (same API as the previous backend).

Recomposes a blank brand-template background to a new aspect ratio (outpaint /
crop) instead of stretching it, so ratio variants keep a clean, on-brand look.
"""

import base64

import requests

from app.core.config import settings

MODEL_URL = "https://api.segmind.com/v1/nano-banana-pro"

# Tuned for blank template / poster backgrounds (no people, no text).
RESIZE_PROMPT = (
    "Smart resize this brand template / poster background to the target aspect "
    "ratio. Preserve the original design, colours, gradients, branding and "
    "graphic elements, and the overall composition and visual style. Naturally "
    "extend, outpaint or recompose the background to fill the new frame WITHOUT "
    "stretching or distorting anything. Keep empty/clean space where text will "
    "be placed. Do NOT add any text, letters, numbers, logos, watermarks, "
    "people or new objects. Output a clean, high-quality, photorealistic result "
    "consistent with the original."
)


def is_live() -> bool:
    return bool(settings.segmind_api_key)


def smart_resize(
    *,
    image_url: str,
    aspect_ratio: str = "9:16",
    output_format: str = "jpg",
    output_resolution: str = "2K",
) -> bytes:
    """Call Segmind and return the resized image bytes. Raises on failure."""
    payload = {
        "prompt": RESIZE_PROMPT,
        "image_urls": [image_url],
        "aspect_ratio": aspect_ratio,
        "output_format": output_format,
        "output_resolution": output_resolution,
        "response_modalities": "IMAGE",
    }
    resp = requests.post(
        MODEL_URL,
        headers={"x-api-key": settings.segmind_api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=180,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Segmind resize failed: {resp.status_code} {resp.text[:300]}")

    if "application/json" in resp.headers.get("content-type", ""):
        return _extract_bytes(resp.json())
    if not resp.content:
        raise RuntimeError("Segmind returned empty image")
    return resp.content


def _extract_bytes(result: dict) -> bytes:
    """Segmind may return raw base64, a list, or a URL depending on the model."""
    if "image" in result:
        return base64.b64decode(result["image"])
    if result.get("images"):
        first = result["images"][0]
        if isinstance(first, str) and first.startswith("http"):
            r = requests.get(first, timeout=60)
            r.raise_for_status()
            return r.content
        if isinstance(first, str):
            return base64.b64decode(first)
    if isinstance(result.get("output"), str):
        out = result["output"]
        if out.startswith("http"):
            r = requests.get(out, timeout=60)
            r.raise_for_status()
            return r.content
        return base64.b64decode(out)
    raise RuntimeError(f"Unsupported Segmind response format: {list(result)[:5]}")
