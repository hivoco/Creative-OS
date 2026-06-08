"""Add the `review_status` column to `video_job` for the video review workflow.

`Base.metadata.create_all()` creates the new `video_review_request` and
`video_comment` tables on startup, but it does NOT add new columns to a table
that already exists. Run this once after pulling the video-review change:

    python migrate_video_review.py

Idempotent: it checks information_schema and only adds the column if missing,
so it is safe to run more than once.
"""

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    with engine.begin() as conn:
        existing = {
            row[0]
            for row in conn.execute(
                text(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() "
                    "AND TABLE_NAME = 'video_job'"
                )
            )
        }
        if "review_status" in existing:
            print("· review_status already present — skipping")
        else:
            conn.execute(
                text(
                    "ALTER TABLE video_job "
                    "ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'draft'"
                )
            )
            print("✓ added review_status")
    print("Done. (video_review_request / video_comment tables are auto-created.)")


if __name__ == "__main__":
    main()
