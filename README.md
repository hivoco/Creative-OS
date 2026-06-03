# Creative OS

A multi-brand, multilingual brand-template management platform. Brands log in,
upload blank image templates, place rich text, translate it into many languages,
adapt to different aspect ratios, and route versions through review — all
auto-saved. Full spec: [`reference.md`](reference.md).

This repo holds two apps:

| Folder | What | Stack |
| --- | --- | --- |
| [`backend/`](backend/) | REST API, auth, DB, render pipeline | FastAPI + SQLAlchemy (MySQL) + Pillow + Gemini |
| [`frontend/`](frontend/) | Editor & dashboard UI | Vite + React + TS + Tailwind v4 (shared `workspace-tools` theme) |

## Quick start

**Backend** (port 8000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set DATABASE_URL (MySQL), JWT_SECRET, GEMINI_API_KEY
python download_fonts.py      # Noto fonts for multilingual export
python seed.py                # creates tables + demo brand/users
uvicorn app.main:app --reload --port 8000
```

**Frontend** (port 6101):

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:6101` and sign in:

- `editor@mamaearth.com` / `editor123` — editor (upload, edit, translate, export)
- `manager@mamaearth.com` / `manager123` — manager (read-only, review)

## What's in this vertical slice

- ✅ Multi-tenant auth (JWT with `brand_id` + `role`), row-level isolation
- ✅ Role enforcement on the backend (editors mutate; managers read/review)
- ✅ Template upload (blank image → S3-style local storage) + versioning
- ✅ Text layers with percentage geometry, draggable on the canvas
- ✅ Rich text as Quill Delta JSON, per layer per language
- ✅ Two-layer auto-save (localStorage + debounced DB) with restore banner
- ✅ Per-language text style (font/weight/italic/size/line-height/spacing/color)
- ✅ Gemini translation (all layers en→target) carrying inline formatting; offline fallback
- ✅ Pillow render → composited PNG/JPG with **per-language Noto fonts** (Devanagari/Tamil/Arabic/RTL) and **inline Delta bold/italic/color**
- ✅ Ratio variants: LLM layout suggestion + drag-to-adjust editor + publish + render-by-ratio
- ✅ Review workflow: submit → approve/reject, version locking, feedback comments per layer+language
- ✅ Version lifecycle: status transitions + create-new-version (clones layers/translations)

## Not yet built (future, reference.md §14)

Real-time collaboration · per-language font *config table* · export queue ·
template sharing across brands · comment threads/replies · undo/redo ·
version diffing.

> The `backend/` and `frontend/` here are **new** apps for this platform. The
> `iifl` and `workspace-tools` repos in the parent directory are separate and
> were left untouched — only their visual theme was reused in the frontend.
# Creative-OS
