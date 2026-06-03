from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import PkMixin, TimestampMixin


class Brand(PkMixin, TimestampMixin, Base):
    __tablename__ = "brand"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(16), default="#C1FF72")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(16), default="active")

    users: Mapped[list["BrandUser"]] = relationship(
        back_populates="brand", cascade="all, delete-orphan"
    )


class BrandUser(PkMixin, TimestampMixin, Base):
    __tablename__ = "brand_user"

    brand_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("brand.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="editor")  # editor | manager
    status: Mapped[str] = mapped_column(String(16), default="active")

    brand: Mapped["Brand"] = relationship(back_populates="users")
