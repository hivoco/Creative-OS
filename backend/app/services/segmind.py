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

# Generic RECOMPOSE prompt for ANY finished design (people, products, objects,
# graphics or abstract — with or without text). Works for ANY target ratio.
#
# Why recompose instead of pure outpaint: when the target ratio differs a lot
# from the source (e.g. a landscape design -> a 9:16 story), hard-locking the
# original pixels and only painting new background leaves all the real content
# trapped in a band with big empty zones above/below. So instead we let the
# model RE-LAY-OUT the existing elements to fill the new frame — like a designer
# adapting the creative — while keeping every element's identity (wording, face,
# logo, colours, fonts) exactly intact. It makes no assumption about what is in
# the image.
RECOMPOSE_PROMPT = (
    "Re-compose this FINISHED marketing creative to the target aspect ratio so "
    "it looks like it was designed for that frame from the start. This is a "
    "layout RE-COMPOSITION, not a padding or outpaint task: you may reposition "
    "and resize the existing elements to suit the new orientation.\n\n"
    "PRESERVE THE IDENTITY of every existing element exactly — change only their "
    "placement and scale, never what they are:\n"
    "- People/subjects: keep the identical face, hair, expression, skin tone, "
    "clothing and pose. Do not change, swap, beautify or add anyone.\n"
    "- Text: keep every word, letter, number, language, casing, font, weight and "
    "colour identical. Re-typeset it crisply at its new size — NEVER garble, "
    "misspell, warp, translate or invent letters.\n"
    "- Logos, icons, buttons, graphic motifs, colours and overall brand style: "
    "keep them identical in form and colour.\n"
    "- There must be exactly ONE of each element — never duplicate, clone, "
    "mirror or repeat anything.\n\n"
    "RE-ARRANGE TO FILL THE FRAME: reposition and rescale the subject, text, "
    "logo and CTA so they are balanced across the WHOLE target frame — no large "
    "empty zones, nothing squeezed into a central band, no crowding. Respect the "
    "visual hierarchy and natural reading order (headline, subject, logo/CTA), "
    "and give text and the CTA clear, legible space.\n\n"
    "BACKGROUND: extend and repaint the brand background — gradients, colours, "
    "patterns and geometric motifs — across the entire new frame at the same "
    "style, scale and angle, so the whole image reads as one cohesive design. "
    "Keep the area behind any text and logos calm so they stay readable.\n\n"
    "Do NOT add any new text, letters, numbers, logos, watermarks, extra people "
    "or faces, or new objects that were not already present. Do NOT stretch, "
    "squash or distort the subject or any element. Output one clean, seamless, "
    "photorealistic, professionally composed image at the target aspect ratio."
)


def is_live() -> bool:
    return bool(settings.segmind_api_key)


def _generate(
    *,
    prompt: str,
    image_url: str,
    aspect_ratio: str,
    output_format: str,
    output_resolution: str,
) -> bytes:
    """POST to Segmind nano-banana-pro and return the image bytes. Raises on
    failure."""
    payload = {
        "prompt": prompt,
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


def smart_resize(
    *,
    image_url: str,
    aspect_ratio: str = "9:16",
    output_format: str = "jpg",
    output_resolution: str = "2K",
) -> bytes:
    """Recompose a BLANK template background to a new aspect ratio."""
    return _generate(
        prompt=RESIZE_PROMPT,
        image_url=image_url,
        aspect_ratio=aspect_ratio,
        output_format=output_format,
        output_resolution=output_resolution,
    )


def recompose_composite(
    *,
    image_url: str,
    aspect_ratio: str = "9:16",
    output_format: str = "jpg",
    output_resolution: str = "2K",
) -> bytes:
    """Recompose a FINISHED composite (design + text already baked in) to a new
    aspect ratio: re-lay-out the existing elements to fill the target frame while
    keeping each element's identity (wording, subject, logo, colours) intact,
    instead of trapping the original in a padded band. Raises on failure."""
    return _generate(
        prompt=RECOMPOSE_PROMPT,
        image_url=image_url,
        aspect_ratio=aspect_ratio,
        output_format=output_format,
        output_resolution=output_resolution,
    )


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
