from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin, utcnow


class BrandVoice(PkMixin, TimestampMixin, Base):
    """A Fish Audio voice cloned by a brand. Fish stores voices in one shared
    account, so this table scopes each voice to the brand that created it."""

    __tablename__ = "brand_voice"

    brand_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand.id"), nullable=False, index=True
    )
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand_user.id"), nullable=False
    )
    voice_id: Mapped[str] = mapped_column(String(64), nullable=False)  # Fish model id
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class VideoJob(PkMixin, Base):
    """A talking-head video render: photo + voice + script → lipsync MP4."""

    __tablename__ = "video_job"

    brand_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand.id"), nullable=False, index=True
    )
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand_user.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), default="Untitled video")

    # pending | processing | completed | failed
    status: Mapped[str] = mapped_column(String(16), default="pending")
    current_stage: Mapped[str] = mapped_column(String(32), default="queued")

    # Review workflow, independent of the generation `status` above.
    # draft | in_review | approved | rejected
    review_status: Mapped[str] = mapped_column(String(16), default="draft")

    # Input
    photo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    voice_id: Mapped[str] = mapped_column(String(64), nullable=False)
    voice_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    script_text: Mapped[str] = mapped_column(Text, nullable=False)
    resolution: Mapped[str] = mapped_column(String(8), default="480p")

    # Per-stage status: pending | processing | completed | failed
    image_status: Mapped[str] = mapped_column(String(16), default="pending")
    audio_status: Mapped[str] = mapped_column(String(16), default="pending")
    lipsync_status: Mapped[str] = mapped_column(String(16), default="pending")

    # Output URLs (S3)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )

    review_requests: Mapped[list["VideoReviewRequest"]] = relationship(
        back_populates="video_job", cascade="all, delete-orphan"
    )


class VideoReviewRequest(PkMixin, Base):
    """A manager review of a finished video, mirroring the template
    ReviewRequest flow. Whole-video feedback — videos have no layers."""

    __tablename__ = "video_review_request"

    video_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("video_job.id"), nullable=False, index=True
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

    video_job: Mapped["VideoJob"] = relationship(back_populates="review_requests")
    comments: Mapped[list["VideoComment"]] = relationship(
        back_populates="review_request", cascade="all, delete-orphan"
    )


class VideoComment(PkMixin, TimestampMixin, Base):
    __tablename__ = "video_comment"

    review_request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("video_review_request.id"), nullable=False, index=True
    )
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[str] = mapped_column(String(16), default="open")  # open | resolved

    review_request: Mapped["VideoReviewRequest"] = relationship(
        back_populates="comments"
    )
