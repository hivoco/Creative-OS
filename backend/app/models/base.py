from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import new_uuid


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PkMixin:
    """UUID primary key stored as CHAR(36) for MySQL portability."""

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
