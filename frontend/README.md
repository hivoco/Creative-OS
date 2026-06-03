# Creative OS — Frontend

Vite + React + TypeScript editor for the multilingual brand template platform.
Reuses the exact theme, fonts (Gilroy), and shadcn UI components from the
`workspace-tools` app (IIFL tokens + `hv-green` palette).

## Stack

- **Vite 8 + React 19 + TypeScript**
- **Tailwind v4** (`@tailwindcss/vite`) + shadcn "new-york" components
- **React Router 7**, **TanStack Query 5**, **Zustand** (auth), **Axios**
- **Quill 2** — rich text stored as Delta JSON (per reference.md §6)

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
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

## Routes

- `/login` — JWT login (demo creds pre-filled).
- `/` — **Dashboard**: brand's templates, upload dialog (editors only).
- `/editor/:versionId` — **Editor**: draggable text layers on the blank-image
  canvas, Quill rich-text per layer/language, language switcher, translate-all,
  and PNG export (server render).

`RequireAuth` gates everything except `/login` and bounces back to the
originating path after sign-in.

## Auto-save (reference.md §5)

Two layers, implemented in `components/editor/useAutoSave.ts`:

1. **localStorage** on every keystroke — key `draft_{versionId}_{layerId}_{lang}`,
   instant, survives refresh/network blips.
2. **Debounced DB save** 1.5s after typing stops — `PUT /layers/:id/translations/:lang`.

On open, the inspector compares the localStorage draft timestamp against the
server's `last_saved_at`; if the local copy is newer it shows a
**"You have unsaved changes — restore?"** banner.

## Layout

```
src/
  lib/          api (axios + JWT interceptor), services (typed API calls),
                delta (Quill Delta <-> plain text), utils (cn)
  store/        auth.ts (Zustand: login / loadMe / logout)
  components/   RequireAuth, AppHeader, UploadTemplateDialog
    editor/     QuillEditor, TemplateCanvas (drag), LayerInspector, useAutoSave
    ui/         shadcn primitives (shared with workspace-tools)
  pages/        LoginPage, DashboardPage, EditorPage
  types.ts      domain types mirroring the backend schemas
  index.css     Tailwind v4 theme + IIFL/hv-green tokens + Gilroy @font-face
```

## Theme

`index.css`, `public/fonts-gilroy/`, and `src/components/ui/*` are copied from
`workspace-tools` so the look matches exactly. The app is wrapped in the
`.app-theme` scope (white canvas, dotted background, Gilroy font). Primary
action color is `hv-green` on `hv-ink`.
