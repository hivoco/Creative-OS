# Creative OS — Project Reference (as built)

> Single source of truth for what has actually been implemented. Pass this file
> to any LLM for full context of the system, its data model, APIs and features.
> The original product spec is preserved in the second half (§13+) for intent.

---

## 1. What This Is

**Creative OS** is a multi-brand, multi-tenant SaaS with **two tools** behind one
login:

1. **Image Templates** — brands upload blank poster/banner images, place rich
   text layers, translate them into many languages, adapt them to different
   aspect ratios, route versions through manager review, and export composited
   images. Everything auto-saves.
2. **Video AI** (editors only) — turn a **photo + script + cloned voice** into a
   **lip-synced talking-head MP4** (async background pipeline).

After login the user lands on a **tool picker** and chooses a tool.

---

## 2. Tech Stack (actual)

| Layer | Tech |
| --- | --- |
| Backend | FastAPI + SQLAlchemy 2.x, **MySQL** (PyMySQL), Pydantic v2 |
| Auth | JWT (python-jose) carrying `brand_id` + `role`, bcrypt (passlib) |
| Image render | **Pillow** + bundled **Noto** fonts (per-language, RTL-aware) |
| LLM | **Gemini** `gemini-3.1-flash-lite-preview` (translation + ratio layout) |
| AI image / resize | **Segmind** `nano-banana-pro` (smart resize), `nano-banana-2` (portrait) |
| Lipsync | **Segmind InfiniteTalk** |
| Voice | **Fish Audio** (`fish-audio-sdk`) — clone + TTS |
| Storage | Local `uploads/` for blank templates; **AWS S3** for resize output + all video assets |
| Frontend | Vite + **React 19** + TypeScript, **Tailwind v4**, **shadcn / Radix UI**, TanStack Query, Zustand, Axios, **Quill 2** (rich text), Sonner |

Repo layout: `creative_os/backend` (FastAPI) and `creative_os/frontend` (Vite).
External API keys live in `backend/.env` (`GEMINI_API_KEY`, `SEGMIND_API_KEY`,
`FISH_API_KEY`, AWS creds, `DATABASE_URL`/`mysql_*`).

---

## 3. Multi-Tenancy & Roles

- Every domain row has a `brand_id`. Every query filters by the `brand_id` from
  the caller's JWT — a brand can never see another brand's data (cross-tenant
  access → `404`).
- Roles: **editor** (create/edit/translate/review-submit, Video AI) and
  **manager** (read-only on content + approve/reject + feedback comments).
  Mutations use `require_editor`; review actions use `require_manager`. Enforced
  on the **backend**, not just the UI.
- Demo users (from `seed.py`): `editor@mamaearth.com / editor123`,
  `manager@mamaearth.com / manager123` (brand "Mamaearth").

---

## 4. Database Model (MySQL)

UUIDs are stored as `CHAR(36)`; JSON columns hold Delta / dimensions / layout.

- **BRAND** — id, name, slug, logo_url, primary_color, timezone, status.
- **BRAND_USER** — id, brand_id→BRAND, name, email, password_hash, role
  (editor|manager), status.
- **TEMPLATE** — id, brand_id, name, category, blank_image_url, dimensions_json
  `{w,h,unit,dpi}`, status.
- **TEMPLATE_VERSION** — id, template_id, created_by, version_number, status
  (draft|in_review|approved|rejected). Creating a new version **clones** the
  previous version's layers + translations.
- **TEXT_LAYER** — id, template_version_id, layer_key, x/y/width/height_percent,
  font_family, **font_weight, italic**, base_font_size, **line_height,
  letter_spacing_pct**, text_align, default_color, default_bg_color.
- **LAYER_TRANSLATION** — id, layer_id, language_code, content_delta (Quill
  Delta JSON), plain_text, status, last_saved_at, and **per-language style
  overrides** (NULL = inherit the layer default): font_family_override,
  font_weight_override, italic_override, font_size_override,
  line_height_override, letter_spacing_override, color_override. → each language
  can carry its own look for the same layer.
- **TEMPLATE_RATIO_VARIANT** — id, template_version_id, ratio, dimensions_json,
  layers_json `{layer_key:{x,y,w,h,font}}`, **blank_image_url** (AI-resized
  background, S3), source (original|llm_suggested|manually_adjusted), status
  (draft|published).
- **REVIEW_REQUEST** — id, template_version_id, requested_by, reviewer_id,
  status (pending|reviewed|approved|rejected), **note** (required reject reason),
  sent_at.
- **FEEDBACK_COMMENT** — id, review_request_id, layer_id, language_code,
  comment, resolved (open|resolved).
- **BRAND_VOICE** — id, brand_id, created_by, voice_id (Fish model id), name,
  description. Scopes shared-account Fish voices to a brand.
- **VIDEO_JOB** — id, brand_id, created_by, title, status, current_stage, input
  (photo_url, voice_id, voice_name, script_text, resolution), per-stage status
  (image/audio/lipsync), output (image_url, audio_url, video_url), error,
  created_at, updated_at.

`Base.metadata.create_all` builds tables on startup; new columns were added by
in-place `ALTER TABLE` so data is preserved.

---

## 5. Backend API

All non-auth routes require a Bearer JWT and are brand-scoped.

**Auth** — `POST /auth/login`, `GET /auth/me`, `GET /auth/brand/members`.

**Templates** — `GET /templates` (with versions), `GET /templates/{id}`,
`POST /templates` (multipart, editor), `DELETE /templates/{id}` (editor,
cascades), `POST /templates/{id}/versions` (editor, clones content).

**Layers / translations** — `GET /versions/{id}` (version + template),
`GET /versions/{id}/layers`, `POST /versions/{id}/layers`,
`PATCH /layers/{id}`, `DELETE /layers/{id}`,
`PUT /layers/{id}/translations/{lang}` (**debounced auto-save target**, carries
text + all per-language overrides).

**Translation** — `POST /translate` (stateless text helper),
`POST /versions/{id}/translate` (translate every layer src→target, re-applying
uniform source formatting).

**Render / ratios** — `GET /versions/{id}/render?language=&ratio=&fmt=`
(Pillow composite → PNG/JPG), `GET|POST /versions/{id}/ratio-variants`,
`PATCH|DELETE /ratio-variants/{id}`. Creating a variant asks Gemini for
non-overlapping positions **and** runs Segmind smart-resize on the blank.

**Review** — `POST /versions/{id}/submit` (editor → locks editing),
`POST /versions/{id}/approve` (manager), `POST /versions/{id}/reject` (manager,
**1–100 word reason required → 422 otherwise**, stored on `review.note`),
`GET|POST /versions/{id}/comments`, `PATCH /comments/{id}`,
`GET /versions/{id}/review`.

**Video AI** (all `require_editor`) — `GET /video/voices`,
`POST /video/voices/clone` (Fish), `GET /video/jobs`, `GET /video/jobs/{id}`,
`POST /video/jobs` (multipart photo+voice+script+resolution → background
pipeline), `DELETE /video/jobs/{id}`.

`GET /uploads/...` serves local blank images. `GET /health` reports liveness.

---

## 6. Render Pipeline (Pillow)

`GET /versions/{id}/render`:
1. Load the blank (local `/uploads` or, for a ratio variant, the S3 AI-resized
   blank); resize to target dimensions.
2. For each layer resolve **per-language style** (override ?? layer default) and
   ratio-variant position if any.
3. Pick a **script-appropriate Noto font** by language (Devanagari, Tamil,
   Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Oriya, **Arabic with
   reshaping + bidi/RTL**). Weight ≥600 uses the Bold file.
4. Draw **inline Quill Delta runs** — per-run bold / italic / color (color
   priority: inline → `color_override` → `default_color`). Multi-line + line
   height + optional background scrim.

Fonts are downloaded by `python download_fonts.py` (OFL, gitignored under
`backend/fonts/`). Without a Gemini/Segmind key the system falls back gracefully
(no-op translate, Pillow stretch instead of AI resize).

---

## 7. Aspect-Ratio Variants

1. Editor opens **Ratios** in the editor, picks a target (1:1, 9:16, 16:9, 4:5,
   3:4).
2. Backend: Gemini suggests new layer positions for the ratio; a **deterministic
   anti-overlap pass** guarantees no two text boxes overlap and all stay inside
   the canvas. In parallel, **Segmind `nano-banana-pro`** recomposes the blank
   background to the new ratio (uploaded to S3) — not a stretch.
3. Editor reviews thumbnails, drags layers to adjust, then **Save draft /
   Publish**. Render uses the variant's positions + AI-resized blank.

---

## 8. Auto-Save & Rich Text

- **Quill Delta JSON** is the text format (safe, translatable, formatting
  preserved). Only `plain_text` is sent to the LLM; formatting is re-applied
  after.
- Two-layer auto-save: **localStorage** on every change
  (`draft_{version}_{layer}_{lang}`) + **debounced 1.5s PUT** to the DB. On open,
  if the local draft is newer than `last_saved_at` a **"restore unsaved
  changes?"** banner appears.
- **Per-language style:** editing style while on Telugu only changes Telugu;
  English is untouched. A not-yet-translated language falls back to showing the
  source language's text. Translation produces **reviewable drafts** (source vs
  translated, Apply / Apply all) and sets a script-appropriate font on apply.

---

## 9. Frontend Routes & Features

Routes: `/login`, `/` (tool picker), `/templates` (dashboard), `/video`,
`/editor/:versionId`. `RequireAuth` gates everything else.

**Editor** highlights:
- Canvas **scales to fit the viewport** (no page scroll); sidebar scrolls on its
  own.
- Layers are **draggable + resizable** (8 handles); click empty canvas to
  deselect; selecting a layer auto-focuses its text box.
- Full per-language style controls (font family/weight/italic/size/color/line
  height/letter spacing) + layer key + background.
- **Version switcher** + delete version; review panel (submit / approve /
  reject-with-reason / feedback comments, status badge).
- **Keyboard shortcuts:** ⌘/Ctrl+⌫ or ⌘/Ctrl+Delete delete layer (works while
  typing), ⌘/Ctrl+D duplicate; when not in the text box: ⌘/Ctrl+C / V / Z =
  layer copy / paste / undo, plain Delete = delete; Esc stops editing /
  deselects. Undo covers add / paste / duplicate / delete / move / resize.

**Video AI** (`/video`, editors only): pick/clone a voice, upload a photo, write
a script, choose 480p/720p, **Generate** (background). **History** shows each
job with **date/time in IST**, per-stage progress (Image · Audio · Lipsync),
inline video player, **Download MP4**, delete; auto-polls while rendering.

**Theme:** Hivoco brand (lime-green primary) on login/tool-picker/dashboard/
video; **neutral black-and-white shadcn** inside the editor (and its portaled
dialogs). UI font Inter; Gilroy kept as a selectable layer font. A
`max-lines: 300` ESLint rule keeps files split.

---

## 10. Video AI Pipeline & Storage

`POST /video/jobs` uploads the photo to S3, creates a `VIDEO_JOB` (pending), and
runs a **FastAPI background task** (fresh DB session):
- Stage 1 (parallel): **nano-banana-2** clean 9:16 portrait + **Fish TTS** audio
  (chosen cloned voice) → both to S3.
- Stage 2: **InfiniteTalk** lipsync (image + audio) → MP4 → S3.
- Per-stage status persisted in MySQL so jobs survive restarts; failures set
  `status=failed` + `error`.

**S3 key layout (per request):** `creative_os/video/{brand-slug}/{IST-date}/{job-id}/`
→ `input.jpg`, `portrait.png`, `audio.mp3`, `lipsync.mp4`. Voices are scoped per
brand via `BRAND_VOICE` even though Fish stores them in one account.

---

## 11. Running It

**Backend** (port 8000):
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # MySQL, JWT, Gemini, Segmind, Fish, AWS
python download_fonts.py    # Noto fonts for multilingual export
python seed.py              # tables + demo brand/users
uvicorn app.main:app --reload --port 8000
```
**Frontend** (port 6101): `cd frontend && npm install && npm run dev`
(`VITE_API_BASE_URL=http://localhost:8000`).

---

## 12. Not Built Yet / Future

Real-time collaboration; export queue / batch language export; template sharing
across brands; comment threads (replies); version diffing; Video AI
retry/quota/queue-hardening, captions, background music, aspect-ratio choice.
Render applies size/colour/weight/inline-format; letter-spacing is preview-only
in export.

---
---

# Appendix — Original Product Spec (intent)

The sections below are the original design brief, kept for intent/context. Where
they differ from §1–12, the implementation above is authoritative.

## Core Concepts

**Blank Template** — a PNG/JPG with no baked text; text is composited on top at
render time; the blank is never modified, reused across all languages/ratios.

**Text Layer** — a positioned box with percentage geometry (resolution
independent), default font/size/color/bg, and a unique `layer_key`.

**Layer Translation** — one row per language storing Quill Delta + plain text +
font-size and color overrides (extended in the build to a full per-language
style override set).

**Template Version** — numbered v1, v2, …; lifecycle draft → in_review →
approved/rejected; old versions locked, only the latest edited.

**Ratio Variant** — same version adapted to another aspect ratio; the LLM
suggests new positions, the editor confirms before publishing; the blank is
resized at render time (extended in the build to Segmind AI recompose).

## Color System (priority high→low)
1. Inline color inside `content_delta`
2. `LAYER_TRANSLATION.color_override`
3. `TEXT_LAYER.default_color`
Plus optional `TEXT_LAYER.default_bg_color` scrim.

## Auto-Save Strategy
localStorage on every keystroke + debounced 1.5s DB PATCH; on load compare
`last_saved_at` vs local draft and offer restore. Real-time collab intentionally
deferred (data model supports it).

## Rich Text — Quill Delta JSON
Safe (no XSS), supports inline formatting per word, easy to extract plain text
for the LLM and re-apply formatting after translation. Never send Delta to the
LLM — only plain text.

## LLM Usage
- **Translation:** plain text in, translated text out, formatting re-applied,
  saved as a new `LAYER_TRANSLATION`.
- **Ratio layout:** image + current layout + source/target ratio in, new
  positions JSON out; editor confirms before publishing.

## Technology Decisions (original)
Quill Delta for rich text; S3/Cloudinary for images (never store rendered);
Sharp/Pillow for server-side resize; debounced + localStorage auto-save;
percentage positions; `brand_id` on every query for tenant isolation; LLM gets
plain text only; LLM suggests ratio positions, server renders.
