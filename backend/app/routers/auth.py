from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.security import create_access_token, verify_password
from app.models import Brand, BrandUser
from app.schemas.auth import BrandOut, LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(BrandUser).filter(BrandUser.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive"
        )

    brand = db.get(Brand, user.brand_id)
    token = create_access_token(
        user_id=user.id, brand_id=user.brand_id, role=user.role
    )
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        brand=BrandOut.model_validate(brand),
    )


@router.get("/brand/members", response_model=list[UserOut])
def brand_members(
    current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """All users in the caller's brand (for reviewer assignment)."""
    return (
        db.query(BrandUser)
        .filter(BrandUser.brand_id == current.brand_id, BrandUser.status == "active")
        .all()
    )


@router.get("/me", response_model=LoginResponse)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    brand = db.get(Brand, current.brand_id)
    token = create_access_token(
        user_id=current.id, brand_id=current.brand_id, role=current.role
    )
    return LoginResponse(
        access_token=token,
        user=UserOut.model_validate(current.user),
        brand=BrandOut.model_validate(brand),
    )
