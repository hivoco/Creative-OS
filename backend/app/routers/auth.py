from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, bearer_scheme, get_current_user
from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
)
from app.models import Brand, BrandUser, SuperAdmin
from app.schemas.auth import AdminOut, BrandOut, LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _admin_response(admin: SuperAdmin) -> LoginResponse:
    token = create_access_token(
        user_id=admin.id, role="superadmin", account_type="superadmin"
    )
    return LoginResponse(
        access_token=token,
        account_type="superadmin",
        admin=AdminOut.model_validate(admin),
    )


def _brand_user_response(user: BrandUser, brand: Brand) -> LoginResponse:
    token = create_access_token(
        user_id=user.id, brand_id=user.brand_id, role=user.role
    )
    return LoginResponse(
        access_token=token,
        account_type="brand_user",
        user=UserOut.model_validate(user),
        brand=BrandOut.model_validate(brand),
    )


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Super admin takes precedence (separate table, no brand).
    admin = db.query(SuperAdmin).filter(SuperAdmin.email == req.email).first()
    if admin and verify_password(req.password, admin.password_hash):
        return _admin_response(admin)

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
    if not brand or brand.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Brand is inactive"
        )
    return _brand_user_response(user, brand)


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
def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Refresh the current session for either a super admin or a brand user."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    if payload.get("typ") == "superadmin":
        admin = db.get(SuperAdmin, payload.get("sub"))
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Super admin not found"
            )
        return _admin_response(admin)

    user = db.get(BrandUser, payload.get("sub"))
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    brand = db.get(Brand, user.brand_id)
    if not brand or brand.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Brand is inactive"
        )
    return _brand_user_response(user, brand)
