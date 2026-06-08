# Creative OS

A multi-brand, multi-tenant SaaS with **two creative tools behind one login**:

1. **Image Templates** — brands upload blank poster/banner images, place rich
   text layers, translate them into many languages, adapt them to different
   aspect ratios, route versions through manager review, and export composited
   images. Everything auto-saves.
2. **Video AI** (editors only) — turn a **photo + script + cloned voice** into a
   **lip-synced talking-head MP4** through an async background pipeline.

After login, users land on a **tool picker** and choose a tool. A separate
**super admin** console manages brands and their users.

> Full as-built spec — data model, APIs, every feature: [`reference.md`](reference.md).

This repo holds two apps:

| Folder | What | Stack |
| --- | --- | --- |
| [`backend/`](backend/) | REST API, auth, DB, render pipeline, Video AI | FastAPI + SQLAlchemy (MySQL) + Pillow + Gemini + Segmind + Fish Audio + S3 |
| [`frontend/`](frontend/) | Editor, dashboards, Video AI & admin UI | Vite 8 + React 19 + TS + Tailwind v4 + shadcn/Radix |

---

## Quick start

**Backend** (port 8000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # DATABASE_URL (MySQL), JWT_SECRET, and the keys below
python download_fonts.py      # Noto fonts for multilingual export
python seed.py                # creates tables + demo brand/users
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`. Tables auto-create on startup; a super
admin is seeded from `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` if set.

**Frontend** (port 6001):

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:6001` and sign in (one login form for all roles):

- `editor@mamaearth.com` / `editor123` — editor (upload, edit, translate, export, Video AI)
- `manager@mamaearth.com` / `manager123` — manager (read-only, approve/reject, comments)
- super admin → set `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` in `backend/.env`, then it routes to `/admin`

---

## API keys & configuration

Set in `backend/.env` (see [`backend/.env.example`](backend/.env.example)). All
external integrations degrade gracefully when their key is missing:

| Var | Used for | If missing |
| --- | --- | --- |
| `DATABASE_URL` (or `mysql_*` parts) | MySQL connection | — (required; SQLite URL works for local dev) |
| `JWT_SECRET` | Auth tokens | — (required) |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Seed the single global admin on startup | no admin seeded |
| `GEMINI_API_KEY` | Translation + ratio-layout suggestions | no-op translator |
| `SEGMIND_API_KEY` | AI smart-resize (`nano-banana-pro`), Video portrait (`nano-banana-2`), lipsync (InfiniteTalk) | Pillow stretch / Video AI disabled |
| `FISH_API_KEY` | Voice clone + TTS for Video AI | voice features disabled |
| `AWS_*` / `S3_BASE_PREFIX` | Public URLs for Segmind input + resized/video output | smart-resize & video storage disabled |

---

## Feature overview

**Multi-tenancy & roles**
- Every domain row carries a `brand_id`; every query filters by the caller's JWT
  `brand_id` — cross-tenant access returns `404`.
- Roles enforced on the **backend**: **editor** (create/edit/translate/submit,
  Video AI), **manager** (read-only + approve/reject + feedback comments),
  **super admin** (brand & user management, global).

**Image Templates**
- ✅ Template upload (blank image) + numbered versions; new version **clones**
  the previous version's layers + translations.
- ✅ Draggable + resizable (8-handle) text layers with percentage geometry.
- ✅ Rich text as **Quill Delta JSON**, per layer per language, with full
  **per-language style overrides** (font/weight/italic/size/line-height/spacing/color).
- ✅ Two-layer auto-save (localStorage on every keystroke + debounced 1.5s DB
  save) with a page-load **draft-recovery sweep** and restore banner.
- ✅ **Gemini translation** (all layers source→target) carrying inline
  formatting, surfaced as reviewable drafts (Apply / Apply all).
- ✅ **Client-side canvas export** — the browser composites blank + text exactly
  as shown in the editor (wrapping, fonts, inline bold/italic/color), so exports
  match the editor pixel-for-pixel.
- ✅ Server-side **Pillow render** with per-language Noto fonts
  (Devanagari/Tamil/Telugu/Kannada/Malayalam/Bengali/Gujarati/Gurmukhi/Oriya,
  **Arabic reshaping + RTL/bidi**) — used for variant thumbnails.
- ✅ **Ratio variants** (1:1, 9:16, 16:9, 4:5, 3:4): Gemini layout suggestion +
  deterministic anti-overlap pass + **Segmind AI recompose** of the blank
  background (not a stretch) + drag-to-adjust + publish.
- ✅ **Review workflow**: submit → approve / reject (1–100 word reason required),
  version locking, per-layer+language feedback comments with resolve/reopen.

**Video AI** (editors only)
- ✅ Pick or **clone a voice** (Fish Audio), upload a photo, write a script,
  choose 480p/720p, **Generate** (background pipeline).
- ✅ Stage 1 (parallel): `nano-banana-2` clean 9:16 portrait + Fish TTS audio.
  Stage 2: **InfiniteTalk** lipsync → MP4. All assets on S3.
- ✅ History with IST timestamps, per-stage progress (Image · Audio · Lipsync),
  inline player, download MP4, delete; auto-polls while rendering. Jobs persist
  in MySQL and survive restarts.

**Super admin console** (`/admin`)
- ✅ Create / edit / deactivate / delete brands (with per-brand template, video &
  user counts).
- ✅ Manage brand users (editor/manager, status, password resets).

---

## Not yet built (future, reference.md §12)

Real-time collaboration · per-language font config table · export queue / batch
language export · template sharing across brands · comment threads (replies) ·
version diffing · Video AI retry/quota/queue-hardening, captions, background
music, aspect-ratio choice. (In export, letter-spacing is preview-only.)
