"""Add per-translation coordinate override columns to `layer_translation`.

`Base.metadata.create_all()` only creates missing tables — it does NOT add new
columns to a table that already exists. Run this once after pulling the
per-language coordinates change:

    python migrate_translation_coords.py

Idempotent: it checks information_schema and only adds columns that are missing,
so it is safe to run more than once.
"""

from sqlalchemy import text

from app.core.database import engine

COLUMNS = (
    "x_percent_override",
    "y_percent_override",
    "width_percent_override",
    "height_percent_override",
)


def main() -> None:
    with engine.begin() as conn:
        existing = {
            row[0]
            for row in conn.execute(
                text(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = 'layer_translation'"
                )
            )
        }
        for col in COLUMNS:
            if col in existing:
                print(f"· {col} already present — skipping")
                continue
            conn.execute(
                text(f"ALTER TABLE layer_translation ADD COLUMN {col} FLOAT NULL")
            )
            print(f"✓ added {col}")
    print("Done.")


if __name__ == "__main__":
    main()
