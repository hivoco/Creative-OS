"""Segmind image (nano-banana-2 portrait) + lipsync (InfiniteTalk) for Video AI."""

import os
import time

import requests

from app.core.config import settings

PORTRAIT_PROMPT = (
    "Create a realistic professional portrait from the uploaded photo. "
    "Keep the same person's face and identity. Use a clean background, natural "
    "lighting, premium business video style."
)
LIPSYNC_ENDPOINT = "https://api.segmind.com/v1/infinite-talk"
LIPSYNC_PROMPT = (
    "Natural talking head video, realistic lip sync, subtle facial movement."
)


def generate_portrait(photo_url: str) -> bytes:
    """nano-banana-2: clean 9:16 portrait from the uploaded photo."""
    import segmind

    os.environ["SEGMIND_API_KEY"] = settings.segmind_api_key
    resp = segmind.run(
        "nano-banana-2",
        prompt=PORTRAIT_PROMPT,
        image_urls=[photo_url],
        aspect_ratio="9:16",
        output_format="png",
        output_resolution="1K",
        response_modalities="IMAGE",
        web_search=False,
        thinking_level="minimal",
        safety_tolerance=4,
    )
    if not resp.content:
        raise RuntimeError("Segmind returned an empty image")
    return resp.content


def generate_lipsync(
    *, image_url: str, audio_url: str, resolution: str = "480p", fps: int = 25
) -> bytes:
    headers = {"x-api-key": settings.segmind_api_key, "Content-Type": "application/json"}
    payload = {
        "prompt": LIPSYNC_PROMPT,
        "image": image_url,
        "audio": audio_url,
        "resolution": resolution,
        "fps": fps,
        "seed": -1,
        "base64": False,
    }
    for attempt in range(3):
        r = requests.post(
            LIPSYNC_ENDPOINT, headers=headers, json=payload, timeout=1500, stream=True
        )
        if r.status_code == 502:
            time.sleep(2 * (attempt + 1))
            continue
        if r.status_code != 200:
            raise RuntimeError(f"Segmind lipsync failed ({r.status_code}): {r.text[:300]}")
        if "video" in r.headers.get("Content-Type", ""):
            return b"".join(c for c in r.iter_content(8192) if c)
        data = r.json()
        url = data.get("video")
        if not url:
            raise RuntimeError(f"Unexpected Segmind lipsync response: {data}")
        vr = requests.get(url, timeout=1500)
        vr.raise_for_status()
        return vr.content
    raise RuntimeError("Segmind lipsync failed after retries")
