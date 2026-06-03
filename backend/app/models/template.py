from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin


class Template(PkMixin, TimestampMixin, Base):
    __tablename__ = "template"

    brand_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="campaign")
    blank_image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    # { "w": 1080, "h": 1080, "unit": "px", "dpi": 72 }
    dimensions_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="active")

    versions: Mapped[list["TemplateVersion"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TemplateVersion.version_number",
    )


class TemplateVersion(PkMixin, TimestampMixin, Base):
    __tablename__ = "template_version"

    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template.id"), nullable=False, index=True
    )
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand_user.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # draft | in_review | approved | rejected
    status: Mapped[str] = mapped_column(String(16), default="draft")

    template: Mapped["Template"] = relationship(back_populates="versions")
    layers: Mapped[list["TextLayer"]] = relationship(  # noqa: F821
        back_populates="version", cascade="all, delete-orphan"
    )
    # Cascade these so deleting a version (or its template) removes everything
    # below it without tripping foreign-key constraints.
    ratio_variants: Mapped[list["TemplateRatioVariant"]] = relationship(  # noqa: F821
        "TemplateRatioVariant", cascade="all, delete-orphan"
    )
    review_requests: Mapped[list["ReviewRequest"]] = relationship(  # noqa: F821
        "ReviewRequest", cascade="all, delete-orphan"
    )
