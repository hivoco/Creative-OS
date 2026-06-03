"""Seed a demo brand with an editor + manager and one sample template/version.

Run after the DB is reachable:
    python seed.py
"""

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Brand,
    BrandUser,
    LayerTranslation,
    Template,
    TemplateVersion,
    TextLayer,
)

import app.models  # noqa: F401  (populate metadata)


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Brand).filter(Brand.slug == "mamaearth").first():
            print("Seed already present. Skipping.")
            return

        brand = Brand(
            name="Mamaearth",
            slug="mamaearth",
            primary_color="#4CAF50",
            timezone="Asia/Kolkata",
        )
        db.add(brand)
        db.flush()

        editor = BrandUser(
            brand_id=brand.id,
            name="Editor User",
            email="editor@mamaearth.com",
            password_hash=hash_password("editor123"),
            role="editor",
        )
        manager = BrandUser(
            brand_id=brand.id,
            name="Manager User",
            email="manager@mamaearth.com",
            password_hash=hash_password("manager123"),
            role="manager",
        )
        db.add_all([editor, manager])
        db.flush()

        template = Template(
            brand_id=brand.id,
            name="Summer Sale Poster",
            category="campaign",
            blank_image_url="http://localhost:8000/uploads/templates/sample-missing.png",
            dimensions_json={"w": 1080, "h": 1080, "unit": "px", "dpi": 72},
        )
        db.add(template)
        db.flush()

        version = TemplateVersion(
            template_id=template.id,
            created_by=editor.id,
            version_number=1,
            status="draft",
        )
        db.add(version)
        db.flush()

        headline = TextLayer(
            template_version_id=version.id,
            layer_key="headline",
            x_percent=8,
            y_percent=10,
            width_percent=84,
            height_percent=14,
            font_family="Poppins",
            base_font_size=72,
            text_align="left",
            default_color="#FFFFFF",
        )
        db.add(headline)
        db.flush()

        db.add(
            LayerTranslation(
                layer_id=headline.id,
                language_code="en",
                content_delta={"ops": [{"insert": "Big Sale!\n"}]},
                plain_text="Big Sale!",
                status="draft",
            )
        )

        db.commit()
        print("Seeded brand 'Mamaearth'.")
        print("  editor@mamaearth.com / editor123")
        print("  manager@mamaearth.com / manager123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
