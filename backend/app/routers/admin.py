from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_superadmin
from app.core.security import hash_password
from app.models import (
    Brand,
    BrandUser,
    BrandVoice,
    SuperAdmin,
    Template,
    TemplateVersion,
    VideoJob,
)
from app.schemas.admin import (
    AdminOut,
    AdminUpdate,
    BrandCreate,
    BrandDetail,
    BrandUpdate,
    BrandUserCreate,
    BrandUserUpdate,
    BrandWithStats,
)
from app.schemas.auth import UserOut

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_superadmin)]
)

VALID_ROLES = {"editor", "manager"}
VALID_STATUS = {"active", "inactive"}


# ---------------------------------------------------------------- helpers ----
def _stats_maps(db: Session) -> tuple[dict, dict, dict]:
    """Per-brand template / video / user counts via 3 grouped queries (no N+1)."""
    templates = dict(
        db.query(Template.brand_id, func.count(Template.id))
        .group_by(Template.brand_id)
        .all()
    )
    videos = dict(
        db.query(VideoJob.brand_id, func.count(VideoJob.id))
        .group_by(VideoJob.brand_id)
        .all()
    )
    users = dict(
        db.query(BrandUser.brand_id, func.count(BrandUser.id))
        .group_by(BrandUser.brand_id)
        .all()
    )
    return templates, videos, users


def _to_stats(brand: Brand, t: dict, v: dict, u: dict) -> BrandWithStats:
    return BrandWithStats(
        id=brand.id,
        name=brand.name,
        slug=brand.slug,
        status=brand.status,
        primary_color=brand.primary_color,
        logo_url=brand.logo_url,
        timezone=brand.timezone,
        created_at=brand.created_at,
        template_count=t.get(brand.id, 0),
        video_count=v.get(brand.id, 0),
        user_count=u.get(brand.id, 0),
    )


def _brand_detail(brand: Brand, db: Session) -> BrandDetail:
    users = (
        db.query(BrandUser).filter(BrandUser.brand_id == brand.id).all()
    )
    tc = (
        db.query(func.count(Template.id))
        .filter(Template.brand_id == brand.id)
        .scalar()
        or 0
    )
    vc = (
        db.query(func.count(VideoJob.id))
        .filter(VideoJob.brand_id == brand.id)
        .scalar()
        or 0
    )
    return BrandDetail(
        id=brand.id,
        name=brand.name,
        slug=brand.slug,
        status=brand.status,
        primary_color=brand.primary_color,
        logo_url=brand.logo_url,
        timezone=brand.timezone,
        created_at=brand.created_at,
        template_count=tc,
        video_count=vc,
        user_count=len(users),
        users=[UserOut.model_validate(u) for u in users],
    )


def _get_brand(db: Session, brand_id: str) -> Brand:
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


def _assert_email_free(db: Session, email: str, *, exclude_id: str | None = None) -> None:
    q = db.query(BrandUser).filter(BrandUser.email == email)
    if exclude_id:
        q = q.filter(BrandUser.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=409, detail="Email already in use")


def _make_user(brand_id: str, payload: BrandUserCreate) -> BrandUser:
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="role must be editor or manager")
    return BrandUser(
        brand_id=brand_id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )


# ------------------------------------------------------------ super admin ----
@router.get("/me", response_model=AdminOut)
def get_me(admin: SuperAdmin = Depends(get_current_superadmin)):
    return admin


@router.patch("/me", response_model=AdminOut)
def update_me(
    req: AdminUpdate,
    admin: SuperAdmin = Depends(get_current_superadmin),
    db: Session = Depends(get_db),
):
    if req.email and req.email != admin.email:
        exists = (
            db.query(SuperAdmin)
            .filter(SuperAdmin.email == req.email, SuperAdmin.id != admin.id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Email already in use")
        admin.email = req.email
    if req.name is not None:
        admin.name = req.name
    if req.password:
        admin.password_hash = hash_password(req.password)
    db.commit()
    db.refresh(admin)
    return admin


# ----------------------------------------------------------------- brands ----
@router.get("/brands", response_model=list[BrandWithStats])
def list_brands(db: Session = Depends(get_db)):
    t, v, u = _stats_maps(db)
    brands = db.query(Brand).order_by(Brand.created_at.desc()).all()
    return [_to_stats(b, t, v, u) for b in brands]


@router.post("/brands", response_model=BrandDetail, status_code=status.HTTP_201_CREATED)
def create_brand(req: BrandCreate, db: Session = Depends(get_db)):
    if db.query(Brand).filter(Brand.slug == req.slug).first():
        raise HTTPException(status_code=409, detail="Slug already in use")
    for u in req.users:
        _assert_email_free(db, u.email)

    brand = Brand(name=req.name, slug=req.slug)
    if req.primary_color:
        brand.primary_color = req.primary_color
    if req.timezone:
        brand.timezone = req.timezone
    db.add(brand)
    db.flush()

    for u in req.users:
        db.add(_make_user(brand.id, u))
    db.commit()
    db.refresh(brand)
    return _brand_detail(brand, db)


@router.get("/brands/{brand_id}", response_model=BrandDetail)
def get_brand(brand_id: str, db: Session = Depends(get_db)):
    return _brand_detail(_get_brand(db, brand_id), db)


@router.patch("/brands/{brand_id}", response_model=BrandDetail)
def update_brand(brand_id: str, req: BrandUpdate, db: Session = Depends(get_db)):
    brand = _get_brand(db, brand_id)
    if req.slug and req.slug != brand.slug:
        if db.query(Brand).filter(Brand.slug == req.slug, Brand.id != brand.id).first():
            raise HTTPException(status_code=409, detail="Slug already in use")
        brand.slug = req.slug
    if req.status is not None:
        if req.status not in VALID_STATUS:
            raise HTTPException(status_code=400, detail="status must be active or inactive")
        brand.status = req.status
    if req.name is not None:
        brand.name = req.name
    if req.primary_color is not None:
        brand.primary_color = req.primary_color
    if req.logo_url is not None:
        brand.logo_url = req.logo_url
    if req.timezone is not None:
        brand.timezone = req.timezone
    db.commit()
    db.refresh(brand)
    return _brand_detail(brand, db)


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(brand_id: str, db: Session = Depends(get_db)):
    brand = _get_brand(db, brand_id)
    tc = db.query(func.count(Template.id)).filter(Template.brand_id == brand.id).scalar() or 0
    vc = db.query(func.count(VideoJob.id)).filter(VideoJob.brand_id == brand.id).scalar() or 0
    uc = db.query(func.count(BrandUser.id)).filter(BrandUser.brand_id == brand.id).scalar() or 0
    if tc or vc or uc:
        blockers = []
        if tc:
            blockers.append(f"{tc} template(s)")
        if vc:
            blockers.append(f"{vc} video(s)")
        if uc:
            blockers.append(f"{uc} user(s)")
        raise HTTPException(
            status_code=409,
            detail=(
                "Brand still has " + ", ".join(blockers) + ". "
                "Remove them first, or deactivate the brand instead."
            ),
        )
    db.delete(brand)
    db.commit()
    return None


# ------------------------------------------------------------ brand users ----
@router.post(
    "/brands/{brand_id}/users", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
def create_brand_user(
    brand_id: str, req: BrandUserCreate, db: Session = Depends(get_db)
):
    _get_brand(db, brand_id)
    _assert_email_free(db, req.email)
    user = _make_user(brand_id, req)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_brand_user(user_id: str, req: BrandUserUpdate, db: Session = Depends(get_db)):
    user = db.get(BrandUser, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.email and req.email != user.email:
        _assert_email_free(db, req.email, exclude_id=user.id)
        user.email = req.email
    if req.name is not None:
        user.name = req.name
    if req.role is not None:
        if req.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="role must be editor or manager")
        user.role = req.role
    if req.status is not None:
        if req.status not in VALID_STATUS:
            raise HTTPException(status_code=400, detail="status must be active or inactive")
        user.status = req.status
    if req.password:
        user.password_hash = hash_password(req.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(BrandUser, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    referenced = (
        db.query(func.count(TemplateVersion.id))
        .filter(TemplateVersion.created_by == user.id)
        .scalar()
        or db.query(func.count(BrandVoice.id))
        .filter(BrandVoice.created_by == user.id)
        .scalar()
        or db.query(func.count(VideoJob.id))
        .filter(VideoJob.created_by == user.id)
        .scalar()
    )
    if referenced:
        raise HTTPException(
            status_code=409,
            detail="User has created content. Deactivate the account instead of deleting.",
        )
    db.delete(user)
    db.commit()
    return None
