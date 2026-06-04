"""Startup bootstrap helpers."""

import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import SuperAdmin

logger = logging.getLogger(__name__)


def ensure_superadmin() -> None:
    """Create the single super admin from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
    if none exists yet. No-op when the env vars are blank or an admin is present."""
    if not (settings.superadmin_email and settings.superadmin_password):
        return
    db = SessionLocal()
    try:
        if db.query(SuperAdmin).count() > 0:
            return
        db.add(
            SuperAdmin(
                name="Super Admin",
                email=settings.superadmin_email,
                password_hash=hash_password(settings.superadmin_password),
            )
        )
        db.commit()
        logger.info("Seeded super admin %s", settings.superadmin_email)
    finally:
        db.close()
