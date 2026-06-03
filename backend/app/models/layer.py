from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base
from app.models.base import PkMixin, utcnow


class TextLayer(PkMixin, Base):
    __tablename__ = "text_layer"

    template_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_version.id"), nullable=False, index=True
    )
    layer_key: Mapped[str] = mapped_column(String(64), nullable=False)
    x_percent: Mapped[float] = mapped_column(Float, default=0.0)
    y_percent: Mapped[float] = mapped_column(Float, default=0.0)
    width_percent: Mapped[float] = mapped_column(Float, default=50.0)
    height_percent: Mapped[float] = mapped_column(Float, default=10.0)
    font_family: Mapped[str] = mapped_column(String(80), default="Roboto")
    font_weight: Mapped[int] = mapped_column(Integer, default=400)
    italic: Mapped[bool] = mapped_column(Boolean, default=False)
    base_font_size: Mapped[float] = mapped_column(Float, default=32.0)
    line_height: Mapped[float] = mapped_column(Float, default=1.15)
    # Letter spacing as a fraction of canvas width (matches the reference editor).
    letter_spacing_pct: Mapped[float] = mapped_column(Float, default=0.0)
    text_align: Mapped[str] = mapped_column(String(8), default="left")
    default_color: Mapped[str] = mapped_column(String(16), default="#FFFFFF")
    default_bg_color: Mapped[str | None] = mapped_column(String(16), nullable=True)

    version: Mapped["TemplateVersion"] = relationship(  # noqa: F821
        back_populates="layers"
    )
    translations: Mapped[list["LayerTranslation"]] = relationship(
        back_populates="layer", cascade="all, delete-orphan"
    )


class LayerTranslation(PkMixin, Base):
    __tablename__ = "layer_translation"

    layer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("text_layer.id"), nullable=False, index=True
    )
    language_code: Mapped[str] = mapped_column(String(8), nullable=False)  # en, hi, ta
    # Quill Delta JSON, e.g. {"ops": [{"insert": "Big Sale!\n"}]}
    content_delta: Mapped[dict] = mapped_column(JSON, nullable=False)
    plain_text: Mapped[str] = mapped_column(Text, default="")
    # Per-language style overrides. NULL means "inherit the layer default", so
    # each language can carry an independent look for the same layer.
    font_family_override: Mapped[str | None] = mapped_column(String(80), nullable=True)
    font_weight_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    italic_override: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    font_size_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    line_height_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    letter_spacing_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    color_override: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # draft | translated | in_review | approved
    status: Mapped[str] = mapped_column(String(16), default="draft")
    last_saved_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    layer: Mapped["TextLayer"] = relationship(back_populates="translations")
