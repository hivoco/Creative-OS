from datetime import datetime

from pydantic import BaseModel


class Dimensions(BaseModel):
    w: int
    h: int
    unit: str = "px"
    dpi: int = 72


class TemplateOut(BaseModel):
    id: str
    brand_id: str
    name: str
    category: str
    blank_image_url: str
    dimensions_json: dict
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateVersionOut(BaseModel):
    id: str
    template_id: str
    created_by: str
    version_number: int
    status: str
    # The original/authoring language; null until the first content is saved.
    source_language: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateDetailOut(TemplateOut):
    versions: list[TemplateVersionOut] = []
