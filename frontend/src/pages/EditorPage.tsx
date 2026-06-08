import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { TemplateCanvas, type LayerBox } from '@/components/editor/TemplateCanvas'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import { useTranslateDrafts } from '@/components/editor/useTranslateDrafts'
import { useLayerActions } from '@/components/editor/useLayerActions'
import { spliceTranslation } from '@/components/editor/useAutoSave'
import { useDraftRecovery } from '@/components/editor/useDraftRecovery'
import {
  createVersion,
  deleteVersion,
  getBlankImageBlob,
  getTemplate,
  getVersionContext,
  listLayers,
  saveTranslationGeometry,
  updateLayer,
  type TranslationGeometry,
} from '@/lib/services'
import { langLabel } from '@/lib/constants'
import { deltaToPlainText } from '@/lib/delta'
import { renderVersionWithBlank } from '@/lib/canvasRenderer'
import { LANGUAGES, type LayerTranslation, type TextLayer } from '@/types'
import { useAuth } from '@/store/auth'

interface Preview {
  layerId: string
  language: string
  // A partial translation overlaid on the canvas: text/style while typing, and
  // position/size (the *_override fields) while dragging/resizing.
  t: Partial<LayerTranslation>
}

/** Key a live overlay by layer AND language so each (layer, language) edit
 *  keeps its own slot — editing one layer can never drop another's overlay. */
const previewKey = (layerId: string, lang: string) => `${layerId}|${lang}`

export function EditorPage() {
  const { versionId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditor = user?.role === 'editor'
  // Managers get a view-only canvas: it looks like the finished image (no boxes,
  // nothing auto-selected) until they click a layer, which then shows a border.
  const isManager = user?.role === 'manager'

  // `editLang` is the active language variant: what the canvas / inspector /
  // export read & write. The user switches it from the header dropdown; on first
  // load it's auto-detected to whichever language already has content.
  const [editLang, setEditLang] = useState('en')
  // Version id we last auto-detected the active variant for (re-runs on switch).
  const [detectedFor, setDetectedFor] = useState<string | null>(null)
  // Bumped after an apply to force the inspector to re-seed from fresh data.
  const [applyNonce, setApplyNonce] = useState(0)
  // undefined = nothing chosen yet (auto-select first); null = explicitly
  // deselected (e.g. clicked empty canvas).
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined)
  // Optimistic layer-field edits layered over fetched layers.
  const [edits, setEdits] = useState<Record<string, Partial<TextLayer>>>({})
  // Live (unsaved) translations being typed, merged into the canvas. Keyed by
  // `${layerId}|${language}` so every edited layer keeps its overlay — switching
  // the active layer no longer reverts a previously-edited one to stale data.
  const [previews, setPreviews] = useState<Record<string, Preview>>({})
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const queryClient = useQueryClient()

  // Merge a live (unsaved) translation into its own `${layer}|${lang}` overlay
  // slot — partial payloads keep earlier fields. Used both while typing and when
  // recovering drafts on load.
  const upsertPreview = (layerId: string, lang: string, t: Partial<LayerTranslation>) =>
    setPreviews((prev) => {
      const key = previewKey(layerId, lang)
      return { ...prev, [key]: { layerId, language: lang, t: { ...prev[key]?.t, ...t } } }
    })

  // The editor uses the neutral black/white scale; brand green stays on every
  // other page. Toggled on <body> so portaled dialogs inherit it too.
  useEffect(() => {
    document.body.classList.add('theme-neutral')
    return () => document.body.classList.remove('theme-neutral')
  }, [])

  // Remember the active language per version so a refresh stays on it. Only
  // after detection has restored it, so the initial 'en' can't clobber it.
  useEffect(() => {
    if (versionId && detectedFor === versionId) {
      localStorage.setItem(`editLang:${versionId}`, editLang)
    }
  }, [versionId, editLang, detectedFor])

  // Switch which existing language variant the canvas shows / edits.
  function switchVariant(next: string) {
    if (next === editLang) return
    setEditLang(next)
    // Overlays are language-keyed, so other-language edits stay valid and the
    // about-to-show language reads its own slot — nothing to clear here.
  }

  // Translate the version into a not-yet-present language. Source is always the
  // original (most-complete) language — never the variant currently in view —
  // so we don't translate a translation. Opens the draft panel to review first.
  function addLanguage(code: string) {
    void drafts.start(code)
  }

  const ctx = useQuery({
    queryKey: ['version', versionId],
    queryFn: () => getVersionContext(versionId),
    enabled: !!versionId,
  })

  const layersQuery = useQuery({
    queryKey: ['layers', versionId],
    queryFn: () => listLayers(versionId),
    enabled: !!versionId,
  })

  const layers = useMemo(() => {
    return (layersQuery.data ?? []).map((l) => {
      const merged: TextLayer = { ...l, ...edits[l.id] }
      const live = previews[previewKey(l.id, editLang)]
      if (live) {
        const others = merged.translations.filter(
          (tr) => tr.language_code !== live.language,
        )
        const base = merged.translations.find(
          (tr) => tr.language_code === live.language,
        )
        const fallback: LayerTranslation = {
          id: 'preview',
          layer_id: l.id,
          language_code: live.language,
          content_delta: { ops: [] },
          plain_text: '',
          font_family_override: null,
          font_weight_override: null,
          italic_override: null,
          font_size_override: null,
          line_height_override: null,
          letter_spacing_override: null,
          color_override: null,
          status: 'draft',
          last_saved_at: '',
        }
        const liveTranslation: LayerTranslation = {
          ...(base ?? fallback),
          ...live.t,
          language_code: live.language,
        }
        merged.translations = [...others, liveTranslation]
      }
      return merged
    })
  }, [layersQuery.data, edits, previews, editLang])

  // Which languages are "present" (have text in any layer), plus a heuristic
  // fallback original (the most-complete language) used only for old versions
  // that predate the stored source_language.
  const { present, sourceFallback } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of layersQuery.data ?? []) {
      for (const tr of l.translations) {
        if (deltaToPlainText(tr.content_delta).trim()) {
          counts[tr.language_code] = (counts[tr.language_code] ?? 0) + 1
        }
      }
    }
    const present = LANGUAGES.filter((l) => counts[l.code]).map((l) => l.code)
    const sourceFallback = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'en'
    return { present, sourceFallback }
  }, [layersQuery.data])

  // The original/authoring language: the value stored on the version (set once,
  // on the first content save) — stable forever. Falls back to the heuristic
  // only for legacy versions with none yet. Translations are always made FROM it.
  const source = ctx.data?.version.source_language ?? sourceFallback

  // The variants the dropdown offers. On a CONTENTLESS version (no original
  // pinned yet) offer every language as a direct, switchable variant so the user
  // can author in whichever they like — switching to it and typing makes it the
  // original. Once any content exists, lock to the present languages (the rest
  // are then reached via "Add language", i.e. translation FROM the original).
  const variantCodes = present.length
    ? LANGUAGES.filter((l) => present.includes(l.code) || l.code === editLang).map((l) => l.code)
    : LANGUAGES.map((l) => l.code)

  // On load / version switch, RESTORE the language the user was last editing for
  // this version (a refresh stays put); fall back to the original only if there
  // is none. Derived during render (not an effect) to avoid a cascading render.
  if (detectedFor !== versionId && layersQuery.data?.length && ctx.data) {
    const remembered = localStorage.getItem(`editLang:${versionId}`)
    setEditLang(remembered && present.includes(remembered) ? remembered : source)
    setDetectedFor(versionId)
  }

  const selectedLayerId =
    selectedId === undefined ? (isManager ? null : (layers[0]?.id ?? null)) : selectedId
  const selected = layers.find((l) => l.id === selectedLayerId) ?? null
  const template = ctx.data?.template

  // All versions of this template, for the header version switcher.
  const templateQuery = useQuery({
    queryKey: ['template', template?.id],
    queryFn: () => getTemplate(template!.id),
    enabled: !!template?.id,
  })
  const versions = [...(templateQuery.data?.versions ?? [])].sort(
    (a, b) => a.version_number - b.version_number,
  )

  const editable =
    isEditor &&
    (ctx.data?.version.status === 'draft' || ctx.data?.version.status === 'rejected')

  // Recover unsaved drafts for every layer on load (not just the selected one).
  useDraftRecovery({
    versionId,
    editable,
    serverLayers: layersQuery.data,
    queryClient,
    onSeed: (recovered) => recovered.forEach((d) => upsertPreview(d.layerId, d.lang, d.payload)),
  })

  const drafts = useTranslateDrafts({
    sourceLang: source,
    layers,
    // The applied translation is saved under `target`; switch the active variant
    // there to show it. Clear the live preview + re-seed the inspector so the old
    // (pre-translation) text stops masking the result.
    onApplied: (target) => {
      setEditLang(target)
      // Drop only the applied language's overlays so the freshly-refetched
      // translation isn't masked by the pre-translation live copy.
      setPreviews((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([, v]) => v.language !== target)),
      )
      setApplyNonce((n) => n + 1)
      void layersQuery.refetch()
    },
  })

  const actions = useLayerActions({
    versionId,
    layers,
    selectedId,
    refetch: () => layersQuery.refetch(),
    selectLayer: setSelectedId,
    patchLayer: (id, patch) => patchLayer(id, patch),
  })

  function patchLayer(id: string, patch: Partial<TextLayer>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    if (!editable) return
    clearTimeout(patchTimers.current[id])
    patchTimers.current[id] = setTimeout(() => {
      void updateLayer(id, patch).catch(() => toast.error('Could not save layer'))
    }, 500)
  }

  // Position/size is per-language: drag/resize writes the active language's
  // translation, not the shared layer. Optimistic overlay first, debounced save.
  function patchTranslationGeometry(id: string, geom: TranslationGeometry) {
    upsertPreview(id, editLang, geom)
    if (!editable) return
    const key = `geo:${id}|${editLang}`
    clearTimeout(patchTimers.current[key])
    patchTimers.current[key] = setTimeout(() => {
      void saveTranslationGeometry(id, editLang, geom)
        .then((saved) => spliceTranslation(queryClient, versionId, id, editLang, saved))
        .catch(() => toast.error('Could not save position'))
    }, 500)
  }

  function handleMove(id: string, x: number, y: number) {
    patchTranslationGeometry(id, { x_percent_override: x, y_percent_override: y })
  }

  function handleResize(id: string, box: LayerBox) {
    patchTranslationGeometry(id, {
      x_percent_override: box.x_percent,
      y_percent_override: box.y_percent,
      width_percent_override: box.width_percent,
      height_percent_override: box.height_percent,
    })
  }

  async function deleteCurrentVersion() {
    try {
      await deleteVersion(versionId)
      toast.success('Version deleted')
      const remaining = versions.filter((v) => v.id !== versionId)
      if (remaining.length) navigate(`/editor/${remaining[remaining.length - 1].id}`)
      else navigate('/')
    } catch {
      toast.error('Could not delete version')
    }
  }

  async function createNewVersion() {
    if (!template) return
    try {
      const v = await createVersion(template.id)
      toast.success(`Created v${v.version_number}`)
      navigate(`/editor/${v.id}`)
    } catch {
      toast.error('Could not create version')
    }
  }

  // Render the design to an image in the browser (same engine as the canvas),
  // so the export looks exactly like what's on screen — wrapped text and all.
  // The blank is fetched through our API so the canvas isn't CORS-tainted.
  async function exportImage() {
    if (!template) return
    try {
      const blank = await getBlankImageBlob(versionId)
      const blob = await renderVersionWithBlank(blank, {
        width: template.dimensions_json.w,
        height: template.dimensions_json.h,
        layers,
        language: editLang,
        sourceLanguage: source,
        format: 'png',
      })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }


  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <EditorHeader
        versionId={versionId}
        templateName={template?.name}
        versionNumber={ctx.data?.version.version_number}
        versionStatus={ctx.data?.version.status}
        versions={versions}
        blankImageUrl={template?.blank_image_url}
        sourceWidth={template?.dimensions_json.w}
        sourceHeight={template?.dimensions_json.h}
        layers={layers}
        activeLanguage={editLang}
        presentLanguages={variantCodes}
        sourceLanguage={source}
        editable={!!editable}
        isEditor={isEditor}
        onSwitchVersion={(vid) => navigate(`/editor/${vid}`)}
        onDeleteVersion={deleteCurrentVersion}
        onSwitchVariant={switchVariant}
        onAddLanguage={addLanguage}
        onExport={exportImage}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_380px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 items-center justify-center">
          {template ? (
            <TemplateCanvas
              fit
              blankImageUrl={template.blank_image_url}
              width={template.dimensions_json.w}
              height={template.dimensions_json.h}
              layers={layers}
              language={editLang}
              selectedLayerId={selectedLayerId}
              readOnly={isManager}
              onSelect={setSelectedId}
              onMove={handleMove}
              onResize={editable ? handleResize : undefined}
              onCommit={editable ? actions.commitGeometry : undefined}
            />
          ) : (
            <p className="text-muted-foreground">Loading…</p>
          )}
        </div>

        <EditorSidebar
          versionId={versionId}
          versionStatus={ctx.data?.version.status}
          isEditor={isEditor}
          editable={!!editable}
          language={editLang}
          sourceLanguage={source}
          layers={layers}
          selected={selected}
          selectedLayerId={selectedLayerId}
          seedNonce={applyNonce}
          drafts={drafts.drafts}
          draftSourceLabel={langLabel(source)}
          targetLabel={langLabel(drafts.targetLang)}
          applying={drafts.applying}
          onSelectLayer={setSelectedId}
          onAddLayer={actions.addLayer}
          onPatchLayer={patchLayer}
          onDeleteLayer={actions.removeLayer}
          onLivePreview={upsertPreview}
          onCreateVersion={createNewVersion}
          onStatusChange={() => void ctx.refetch()}
          onEditDraft={drafts.editDraft}
          onSkipDraft={drafts.skip}
          onApplyDraft={drafts.applyOne}
          onApplyAllDrafts={drafts.applyAll}
          onCloseDrafts={drafts.clear}
        />
      </div>
    </div>
  )
}
