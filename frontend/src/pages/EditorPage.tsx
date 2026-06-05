import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { TemplateCanvas } from '@/components/editor/TemplateCanvas'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import { useTranslateDrafts } from '@/components/editor/useTranslateDrafts'
import { useEditorShortcuts } from '@/components/editor/useEditorShortcuts'
import { useLayerActions } from '@/components/editor/useLayerActions'
import type { TranslationPayload } from '@/components/editor/useAutoSave'
import {
  createVersion,
  deleteVersion,
  getBlankImageBlob,
  getTemplate,
  getVersionContext,
  listLayers,
  updateLayer,
} from '@/lib/services'
import { langLabel } from '@/lib/constants'
import { deltaToPlainText } from '@/lib/delta'
import { renderVersionWithBlank } from '@/lib/canvasRenderer'
import { LANGUAGES, type LayerTranslation, type TextLayer } from '@/types'
import { useAuth } from '@/store/auth'

interface Preview {
  layerId: string
  language: string
  t: Partial<TranslationPayload>
}

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
  // Live (unsaved) translation being typed, merged into the canvas only.
  const [preview, setPreview] = useState<Preview | null>(null)
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // The editor uses the neutral black/white scale; brand green stays on every
  // other page. Toggled on <body> so portaled dialogs inherit it too.
  useEffect(() => {
    document.body.classList.add('theme-neutral')
    return () => document.body.classList.remove('theme-neutral')
  }, [])

  // Switch which existing language variant the canvas shows / edits.
  function switchVariant(next: string) {
    if (next === editLang) return
    setEditLang(next)
    setPreview(null)
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
      if (preview && preview.layerId === l.id) {
        const others = merged.translations.filter(
          (tr) => tr.language_code !== preview.language,
        )
        const base = merged.translations.find(
          (tr) => tr.language_code === preview.language,
        )
        const fallback: LayerTranslation = {
          id: 'preview',
          layer_id: l.id,
          language_code: preview.language,
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
        const live: LayerTranslation = {
          ...(base ?? fallback),
          ...preview.t,
          language_code: preview.language,
        }
        merged.translations = [...others, live]
      }
      return merged
    })
  }, [layersQuery.data, edits, preview])

  // Per-version language stats from saved content: which languages are "present"
  // (have text in any layer) and which is the "source" — the original, taken as
  // the most-complete language. Translations are always made from the source.
  const { present, source } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of layersQuery.data ?? []) {
      for (const tr of l.translations) {
        if (deltaToPlainText(tr.content_delta).trim()) {
          counts[tr.language_code] = (counts[tr.language_code] ?? 0) + 1
        }
      }
    }
    const present = LANGUAGES.filter((l) => counts[l.code]).map((l) => l.code)
    const source = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'en'
    return { present, source }
  }, [layersQuery.data])

  // The variants the dropdown offers: present languages, plus the active one so
  // a brand-new (contentless) version still shows its working language.
  const variantCodes = LANGUAGES.filter(
    (l) => present.includes(l.code) || l.code === editLang,
  ).map((l) => l.code)

  // On first load (and on version switch), point the active variant at the
  // source so the canvas shows text instead of an empty slot. Derived during
  // render (not an effect) to avoid a cascading re-render.
  if (detectedFor !== versionId && layersQuery.data?.length) {
    setEditLang(source)
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

  const drafts = useTranslateDrafts({
    sourceLang: source,
    layers,
    // The applied translation is saved under `target`; switch the active variant
    // there to show it. Clear the live preview + re-seed the inspector so the old
    // (pre-translation) text stops masking the result.
    onApplied: (target) => {
      setEditLang(target)
      setPreview(null)
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

  useEditorShortcuts(!!editable, {
    onDelete: () => selected && void actions.removeLayer(selected.id),
    onCopy: () => actions.copy(selected),
    onPaste: () => void actions.paste(),
    onDuplicate: () => void actions.cloneFrom(selected),
    onUndo: () => void actions.undo(),
    onDeselect: () => setSelectedId(null),
  })

  function patchLayer(id: string, patch: Partial<TextLayer>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    if (!editable) return
    clearTimeout(patchTimers.current[id])
    patchTimers.current[id] = setTimeout(() => {
      void updateLayer(id, patch).catch(() => toast.error('Could not save layer'))
    }, 500)
  }

  function handleMove(id: string, x: number, y: number) {
    patchLayer(id, { x_percent: x, y_percent: y })
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
              onResize={editable ? (id, box) => patchLayer(id, box) : undefined}
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
          onLivePreview={(layerId, lang, t) => setPreview({ layerId, language: lang, t })}
          onTranslationSaved={() => void layersQuery.refetch()}
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
