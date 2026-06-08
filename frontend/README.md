# Creative OS — Frontend

Vite + React + TypeScript UI for the multi-brand, multilingual Creative OS
platform. One app serves four surfaces behind a single login: a **tool picker**,
the **Image Templates** dashboard + editor, the **Video AI** studio, and the
**super admin** console. See [`../reference.md`](../reference.md) for the full
as-built spec.

## Stack

- **Vite 8 + React 19 + TypeScript**
- **Tailwind v4** (`@tailwindcss/vite`) + **shadcn / Radix UI** ("new-york")
- **React Router 7**, **TanStack Query 5**, **Zustand** (auth), **Axios**
- **Quill 2** — rich text stored as Delta JSON (reference.md §8)
- **Sonner** (toasts), **lucide-react** (icons), **nanoid**

## Setup

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:8000
npm run dev              # http://localhost:6101
```

Make sure the backend is running on port 8000 (or update `VITE_API_BASE_URL`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (port 6101) |
| `npm run build` | `tsc -b` + production build |
| `npm run lint` | ESLint (incl. a `max-lines: 300` rule to keep files split) |
| `npm run preview` | Preview the production build |

## Routes

One login form handles every role; the response's `account_type` decides where
you land.

- `/login` — JWT login (demo creds pre-filled).
- `/` — **Tool picker** (Image Templates / Video AI).
- `/templates` — **Dashboard**: brand's templates, upload dialog (editors only).
- `/editor/:versionId` — **Editor** (see below). Remounts on version switch so
  transient state resets cleanly.
- `/video` — **Video AI studio** (editors only): pick/clone a voice, upload a
  photo, write a script, generate, and track jobs.
- `/admin` & `/admin/brands/:brandId` — **Super admin** console (brands + users).

`RequireAuth` gates the app surfaces; `RequireAdmin` gates the admin routes.
Unknown paths redirect to `/`.

## Editor

- Canvas **scales to fit the viewport** (no page scroll); the sidebar scrolls on
  its own.
- Layers are **draggable + resizable** (8 handles); click empty canvas to
  deselect; selecting a layer auto-focuses its text box.
- Full **per-language style** controls (font family/weight/italic/size/color/
  line-height/letter-spacing) + layer key + background scrim.
- **Language switcher** + translate-all (Gemini), surfaced as reviewable drafts
  (`TranslateDraftsPanel`: source vs translated, Apply / Apply all).
- **Version switcher** + delete version; **review panel** (submit / approve /
  reject-with-reason / feedback comments, status badge).
- **Ratios** dialog: pick a target ratio, get an AI layout + AI-resized blank,
  drag to adjust, save draft / publish.
- **Keyboard shortcuts:** ⌘/Ctrl+⌫ or ⌘/Ctrl+Delete delete layer (works while
  typing), ⌘/Ctrl+D duplicate; when not in the text box: ⌘/Ctrl+C / V / Z =
  layer copy / paste / undo, plain Delete = delete; Esc stops editing /
  deselects. Undo covers add / paste / duplicate / delete / move / resize.

## Rendering & export (client-side)

`lib/canvasRenderer.ts` composites the blank image + text layers onto an HTML5
`<canvas>`, mirroring exactly how `TemplateCanvas` paints the DOM — same
wrapping, fonts, and inline Delta bold/italic/color. **The browser is the source
of truth for exports**, so a downloaded PNG/JPG matches the editor pixel-for-
pixel (the old server-side render diverged on text wrapping).

- **Export**: `EditorPage` fetches the blank from `/versions/:id/blank-image`
  and calls `renderVersionWithBlank` → downloads a blob.
- **Ratio variants**: the client renders a composite and POSTs it to
  `/versions/:id/ratio-variants/from-composite`.
- Server-side Pillow render (`/versions/:id/render`) is still used for variant
  thumbnails (`VariantThumb`).

## Auto-save & draft recovery (reference.md §8)

Two layers, in `components/editor/useAutoSave.ts`:

1. **localStorage** on every keystroke — key
   `draft_{versionId}_{layerId}_{lang}`, instant, survives refresh/network blips.
2. **Debounced DB save** 1.5s after typing stops —
   `PUT /layers/:id/translations/:lang`.

`useDraftRecovery.ts` runs once per `versionId` on load: it **sweeps every**
localStorage draft for the version (not just the selected layer), seeds them onto
the canvas, flushes each to the DB, and discards drafts whose layer no longer
exists — so nothing stays invisibly unsaved.

## Layout

```
src/
  lib/          api (axios + JWT interceptor), services / videoServices (typed
                API calls), canvasRenderer (client composite + export), delta
                (Quill Delta <-> runs/plain text), constants, utils (cn)
  store/        auth.ts (Zustand: login / loadMe / logout; user|brand|admin)
  components/
    RequireAuth, RequireAdmin, AppHeader, UploadTemplateDialog
    editor/     QuillEditor, TemplateCanvas (drag/resize), LayerInspector,
                LayerStyleControls, AddLayerDialog, RatioDialog, VariantThumb,
                ReviewPanel, EditorHeader/Sidebar, TranslateDraftsPanel,
                useAutoSave, useDraftRecovery, useLayerActions, useTranslateDrafts
    video/      VideoComposer, VideoJobCard, VideoStages, CloneVoiceDialog
    ui/         shadcn / Radix primitives
  pages/        LoginPage, ToolPickerPage, DashboardPage, EditorPage, VideoPage,
                admin/ (BrandsAdminPage, BrandDetailPage, AdminHeader)
  types.ts      domain types mirroring the backend schemas
  index.css     Tailwind v4 theme + brand tokens + @font-face
```

## Theme

Hivoco brand (lime-green primary) on the login / tool-picker / dashboard / video
/ admin surfaces; **neutral black-and-white shadcn** inside the editor (and its
portaled dialogs) so colour choices read true on the canvas. UI font is **Inter**;
**Gilroy** is kept as a selectable layer font.
