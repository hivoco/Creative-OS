import os
from pathlib import Path

from app.core.config import settings
from app.core.security import new_uuid

UPLOAD_ROOT = Path(settings.upload_dir)


def ensure_upload_dir() -> None:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def save_blank_image(*, data: bytes, original_name: str) -> str:
    """Persist a blank template image locally and return its public URL."""
    ensure_upload_dir()
    ext = os.path.splitext(original_name)[1].lower() or ".png"
    key = f"templates/{new_uuid()}{ext}"
    dest = UPLOAD_ROOT / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"{settings.public_base_url}/uploads/{key}"


def save_bytes(*, data: bytes, key: str) -> str:
    """Write arbitrary bytes under uploads/<key> and return the public URL."""
    ensure_upload_dir()
    dest = UPLOAD_ROOT / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"{settings.public_base_url}/uploads/{key}"


def local_path_for_url(url: str) -> Path | None:
    """Map a public /uploads URL back to a local file path, if it is one."""
    marker = "/uploads/"
    if marker not in url:
        return None
    key = url.split(marker, 1)[1]
    return UPLOAD_ROOT / key
