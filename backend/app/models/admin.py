from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin


class SuperAdmin(PkMixin, TimestampMixin, Base):
    """The single global super admin. Kept in its own table (not BrandUser) so
    BrandUser.brand_id stays NOT NULL and brand-scoped queries never see it."""

    __tablename__ = "super_admin"

    name: Mapped[str] = mapped_column(String(120), default="Super Admin", nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
