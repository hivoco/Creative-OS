from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin, utcnow


class ReviewRequest(PkMixin, Base):
    __tablename__ = "review_request"

    template_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_version.id"), nullable=False, index=True
    )
    requested_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand_user.id"), nullable=False
    )
    reviewer_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("brand_user.id"), nullable=True
    )
    # pending | reviewed | approved | rejected
    status: Mapped[str] = mapped_column(String(16), default="pending")
    # Required reason when rejecting (1–100 words); optional otherwise.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    comments: Mapped[list["FeedbackComment"]] = relationship(
        back_populates="review_request", cascade="all, delete-orphan"
    )


class FeedbackComment(PkMixin, TimestampMixin, Base):
    __tablename__ = "feedback_comment"

    review_request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("review_request.id"), nullable=False, index=True
    )
    layer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("text_layer.id"), nullable=False
    )
    language_code: Mapped[str] = mapped_column(String(8), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[str] = mapped_column(String(16), default="open")  # open | resolved

    review_request: Mapped["ReviewRequest"] = relationship(back_populates="comments")
