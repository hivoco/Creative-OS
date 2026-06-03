from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class BrandOut(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None = None
    primary_color: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    brand_id: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    brand: BrandOut
