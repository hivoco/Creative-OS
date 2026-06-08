from datetime import datetime

from pydantic import BaseModel


class TextLayerCreate(BaseModel):
    layer_key: str
    x_percent: float = 0.0
    y_percent: float = 0.0
    width_percent: float = 50.0
    height_percent: float = 10.0
    font_family: str = "Roboto"
    font_weight: int = 400
    italic: bool = False
    base_font_size: float = 32.0
    line_height: float = 1.15
    letter_spacing_pct: float = 0.0
    text_align: str = "left"
    default_color: str = "#FFFFFF"
    default_bg_color: str | None = None


class TextLayerUpdate(BaseModel):
    layer_key: str | None = None
    x_percent: float | None = None
    y_percent: float | None = None
    width_percent: float | None = None
    height_percent: float | None = None
    font_family: str | None = None
    font_weight: int | None = None
    italic: bool | None = None
    base_font_size: float | None = None
    line_height: float | None = None
    letter_spacing_pct: float | None = None
    text_align: str | None = None
    default_color: str | None = None
    default_bg_color: str | None = None


class LayerTranslationOut(BaseModel):
    id: str
    layer_id: str
    language_code: str
    content_delta: dict
    plain_text: str
    font_family_override: str | None = None
    font_weight_override: int | None = None
    italic_override: bool | None = None
    font_size_override: float | None = None
    line_height_override: float | None = None
    letter_spacing_override: float | None = None
    color_override: str | None = None
    # Per-language position/size; NULL inherits the layer.
    x_percent_override: float | None = None
    y_percent_override: float | None = None
    width_percent_override: float | None = None
    height_percent_override: float | None = None
    status: str
    last_saved_at: datetime

    model_config = {"from_attributes": True}


class TextLayerOut(BaseModel):
    id: str
    template_version_id: str
    layer_key: str
    x_percent: float
    y_percent: float
    width_percent: float
    height_percent: float
    font_family: str
    font_weight: int
    italic: bool
    base_font_size: float
    line_height: float
    letter_spacing_pct: float
    text_align: str
    default_color: str
    default_bg_color: str | None = None
    translations: list[LayerTranslationOut] = []

    model_config = {"from_attributes": True}


class LayerTranslationUpsert(BaseModel):
    """Auto-save payload from the editor (debounced).

    Style fields are per-language overrides; NULL inherits the layer default.
    Position/size are saved separately via the geometry endpoint, so they are
    deliberately absent here and never touched by a text save.
    """

    content_delta: dict
    plain_text: str = ""
    font_family_override: str | None = None
    font_weight_override: int | None = None
    italic_override: bool | None = None
    font_size_override: float | None = None
    line_height_override: float | None = None
    letter_spacing_override: float | None = None
    color_override: str | None = None
    status: str | None = None


class TranslationGeometryUpdate(BaseModel):
    """Partial update of a translation's per-language position/size (from drag /
    resize on the canvas). Only the fields sent are changed, so it never clobbers
    text or style. NULL is a meaningful value here — it resets to the layer."""

    x_percent_override: float | None = None
    y_percent_override: float | None = None
    width_percent_override: float | None = None
    height_percent_override: float | None = None
