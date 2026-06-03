from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin


class TemplateRatioVariant(PkMixin, TimestampMixin, Base):
    __tablename__ = "template_ratio_variant"

    template_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_version.id"), nullable=False, index=True
    )
    ratio: Mapped[str] = mapped_column(String(16), nullable=False)  # 1:1, 9:16, 16:9
    dimensions_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Resized background / finished image for this ratio (S3 or /uploads).
    blank_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # True when blank_image_url is the FINISHED design (text already baked in by
    # the canvas-extend resize) — render serves it directly, no recompositing.
    text_baked: Mapped[bool] = mapped_column(Boolean, default=False)
    # { "headline": { "x": 5, "y": 5, "w": 90, "h": 8, "font": 44 }, ... }
    layers_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # original | llm_suggested | manually_adjusted
    source: Mapped[str] = mapped_column(String(20), default="original")
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | published
