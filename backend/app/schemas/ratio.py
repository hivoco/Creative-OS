from datetime import datetime

from pydantic import BaseModel


class RatioVariantOut(BaseModel):
    id: str
    template_version_id: str
    ratio: str
    dimensions_json: dict
    layers_json: dict
    blank_image_url: str | None = None
    text_baked: bool = False
    source: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RatioVariantUpdate(BaseModel):
    layers_json: dict | None = None
    status: str | None = None  # draft | published
