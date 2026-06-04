from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.schemas.auth import AdminOut, UserOut

__all__ = [
    "AdminOut",
    "AdminUpdate",
    "BrandUserCreate",
    "BrandUserUpdate",
    "BrandCreate",
    "BrandUpdate",
    "BrandWithStats",
    "BrandDetail",
]


class AdminUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None


class BrandUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "editor"  # editor | manager


class BrandUserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role: str | None = None
    status: str | None = None  # active | inactive


class BrandCreate(BaseModel):
    name: str
    slug: str
    primary_color: str | None = None
    timezone: str | None = None
    users: list[BrandUserCreate] = []


class BrandUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    primary_color: str | None = None
    logo_url: str | None = None
    timezone: str | None = None
    status: str | None = None  # active | inactive


class BrandWithStats(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    primary_color: str
    logo_url: str | None = None
    timezone: str
    created_at: datetime
    template_count: int
    video_count: int
    user_count: int

    model_config = {"from_attributes": True}


class BrandDetail(BrandWithStats):
    users: list[UserOut] = []
