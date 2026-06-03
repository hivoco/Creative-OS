"""Fish Audio voice cloning + TTS for the Video AI feature."""

from app.core.config import settings

try:
    from fish_audio_sdk import Session, TTSRequest

    _session = Session(settings.fish_api_key) if settings.fish_api_key else None
except Exception:  # pragma: no cover
    Session = None
    TTSRequest = None
    _session = None


def is_live() -> bool:
    return _session is not None


def list_account_voices() -> list[dict]:
    """All voices on the shared Fish account (brand scoping is done in DB)."""
    if not _session:
        return []
    res = _session.list_models(self_only=True, page_size=50)
    return [
        {"voice_id": m.id, "voice_name": m.title, "description": m.description}
        for m in getattr(res, "items", [])
    ]


def clone_voice(*, audio_bytes: bytes, title: str, description: str = "") -> str:
    if not _session:
        raise RuntimeError("Fish Audio is not configured (FISH_API_KEY missing)")
    model = _session.create_model(
        title=title,
        description=description or "",
        voices=[audio_bytes],
        visibility="private",
    )
    return model.id


def generate_audio(*, text: str, voice_id: str) -> bytes:
    if not _session:
        raise RuntimeError("Fish Audio is not configured (FISH_API_KEY missing)")
    return b"".join(
        _session.tts(TTSRequest(text=text, reference_id=voice_id, format="mp3"))
    )
