# Creative OS — Backend

FastAPI + SQLAlchemy (MySQL) backend for the multi-brand, multilingual brand
template platform described in [`../reference.md`](../reference.md).

## Stack

- **FastAPI** — REST API
- **SQLAlchemy 2.x** — ORM, MySQL via PyMySQL (UUID PKs as `CHAR(36)`, JSON columns)
- **JWT** (python-jose) + **bcrypt** (passlib) — auth, tenant isolation by `brand_id`
- **Gemini** (google-genai) — translation + ratio-layout suggestions (no-op fallback if no key)
- **Pillow** — server-side render pipeline (composites text onto the blank image)

## Setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
```

Create the MySQL database first:

```sql
CREATE DATABASE creative_os CHARACTER SET utf8mb4;
```

Set `DATABASE_URL` in `.env`, e.g.:

```
DATABASE_URL=mysql+pymysql://root:password@127.0.0.1:3306/creative_os
```

Download the Noto fonts used for multilingual export (Hindi, Tamil, Arabic, …):

```bash
python download_fonts.py     # saves OFL fonts under ./fonts (gitignored)
```

Seed a demo brand + users (also creates the tables):

```bash
python seed.py
# editor@mamaearth.com / editor123   (editor role)
# manager@mamaearth.com / manager123 (manager role)
```

Run:

```bash
uvicorn app.main:app --reload --port 8000
```

Tables are auto-created on startup. API docs at `http://localhost:8000/docs`.

> No MySQL handy? Any SQLAlchemy URL works for local dev, e.g.
> `DATABASE_URL=sqlite:///dev.db`. Production target is MySQL.

## Auth & tenancy

- `POST /auth/login` returns a JWT carrying `sub` (user id), `brand_id`, `role`.
- Every query filters by the token's `brand_id`. Cross-tenant access returns `404`.
- **Mutations are editor-only** (`require_editor`). Managers are read + review.
- Locked versions (`in_review`/`approved`) reject layer edits with `409`.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | email + password → JWT |
| GET | `/auth/me` | current user + brand (refreshes token) |
| GET | `/templates` | brand's templates |
| POST | `/templates` | multipart: name, category, dimensions_json, blank_image (editor) |
| GET | `/templates/{id}` | template + versions |
| POST | `/templates/{id}/versions` | new version (editor) |
| GET | `/versions/{id}` | version + parent template (editor canvas context) |
| GET | `/versions/{id}/layers` | text layers + translations |
| POST | `/versions/{id}/layers` | create layer (editor) |
| PATCH | `/layers/{id}` | update geometry/style (editor) |
| DELETE | `/layers/{id}` | delete layer (editor) |
| PUT | `/layers/{id}/translations/{lang}` | **auto-save target** — upsert Delta JSON |
| POST | `/translate` | stateless text translation helper |
| POST | `/versions/{id}/translate` | translate all layers en→target, save rows (carries inline formatting) |
| GET/POST | `/versions/{id}/ratio-variants` | list / LLM-suggest layout for a new ratio |
| PATCH/DELETE | `/ratio-variants/{id}` | adjust layout / publish / delete |
| GET | `/versions/{id}/render` | composite PNG/JPG (`?language=&ratio=&fmt=`) |
| POST | `/versions/{id}/submit` | editor → submit for review (locks editing) |
| POST | `/versions/{id}/approve` \| `/reject` | manager → approve / reject |
| GET/POST | `/versions/{id}/comments` | list / add feedback comments (layer + language) |
| PATCH | `/comments/{id}` | resolve / reopen a comment |
| GET | `/versions/{id}/review` | latest review request + comments |
| GET | `/auth/brand/members` | brand users (reviewer assignment) |
| GET | `/uploads/...` | static blank images |

## Layout

```
app/
  core/       config, database, security (JWT/bcrypt), deps (auth + roles)
  models/     Brand, BrandUser, Template, TemplateVersion, TextLayer,
              LayerTranslation, TemplateRatioVariant, ReviewRequest, FeedbackComment
  schemas/    pydantic request/response models
  routers/    auth, templates, layers, translate, render
  services/   storage (local blank images), gemini (translate + ratio), render (Pillow)
seed.py       demo brand + editor/manager + sample template
```

## Notes / next steps

- Blank images are stored locally under `uploads/` and served at `/uploads`.
  Swap `services/storage.py` for S3/Cloudinary in production (reference.md §2).
- **Ratio variants** use Segmind `nano-banana-pro` to AI-resize the blank
  background to the new aspect ratio (recompose/outpaint, not stretch). The
  blank is uploaded to S3 so Segmind can fetch it; the resized output is stored
  on S3 and referenced by `TEMPLATE_RATIO_VARIANT.blank_image_url`. Falls back
  to Pillow stretching when `SEGMIND_API_KEY` / AWS S3 are not configured. See
  `app/services/segmind.py` (prompt) and `app/services/s3.py`.
- Review workflow models exist (`ReviewRequest`, `FeedbackComment`) but their
  routers are not in this vertical slice yet.
# Creative-OS
