from datetime import datetime

from pydantic import BaseModel


class VoiceOut(BaseModel):
    id: str
    voice_id: str
    name: str
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoJobOut(BaseModel):
    id: str
    title: str
    status: str
    current_stage: str
    voice_id: str
    voice_name: str | None = None
    script_text: str
    resolution: str
    photo_url: str
    image_status: str
    audio_status: str
    lipsync_status: str
    image_url: str | None = None
    audio_url: str | None = None
    video_url: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
