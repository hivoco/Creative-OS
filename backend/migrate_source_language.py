"""Add `template_version.source_language` and backfill existing versions.

`source_language` is the language the canvas was first authored in — the fixed
origin every translation is made from. New versions set it automatically on the
first content-bearing save; this script adds the column and, for versions that
predate the feature, backfills it from the EARLIEST-saved translation that has
text (the best available guess at "the language we started with").

Idempotent — safe to run more than once.

    python migrate_source_language.py
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import engine


def _column_exists(conn) -> bool:
    row = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'template_version' "
            "AND COLUMN_NAME = 'source_language'"
        )
    ).scalar()
    return bool(row)


def main() -> None:
    # 1) Add the column if missing.
    with engine.begin() as conn:
        if _column_exists(conn):
            print("· source_language already present — skipping ALTER")
        else:
            conn.execute(
                text(
                    "ALTER TABLE template_version "
                    "ADD COLUMN source_language VARCHAR(8) NULL"
                )
            )
            print("✓ added template_version.source_language")

    # 2) Backfill versions that don't have one yet, using the earliest-saved
    #    translation that actually has text.
    with Session(engine) as db:
        rows = db.execute(
            text(
                """
                SELECT v.id AS version_id, lt.language_code AS lang
                FROM template_version v
                JOIN text_layer l ON l.template_version_id = v.id
                JOIN layer_translation lt ON lt.layer_id = l.id
                WHERE v.source_language IS NULL
                  AND TRIM(COALESCE(lt.plain_text, '')) <> ''
                ORDER BY v.id, lt.last_saved_at ASC, lt.id ASC
                """
            )
        ).all()

        # First row per version (earliest, because the query is time-ordered).
        first_by_version: dict[str, str] = {}
        for version_id, lang in rows:
            first_by_version.setdefault(version_id, lang)

        for version_id, lang in first_by_version.items():
            db.execute(
                text(
                    "UPDATE template_version SET source_language = :lang "
                    "WHERE id = :vid AND source_language IS NULL"
                ),
                {"lang": lang, "vid": version_id},
            )
            print(f"✓ version {version_id[:8]}… → original = {lang}")
        db.commit()

        if not first_by_version:
            print("· nothing to backfill")
    print("Done.")


if __name__ == "__main__":
    main()
