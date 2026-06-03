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
  getTemplate,
  getVersionContext,
  listLayers,
  updateLayer,
} from '@/lib/services'
import { langLabel } from '@/lib/constants'
import { API_BASE_URL, getToken } from '@/lib/api'
import type { LayerTranslation, TextLayer } from '@/types'
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

  const [language, setLanguage] = useState('en')
  // The language we last came from — the translation source + display fallback.
  const [sourceLanguage, setSourceLanguage] = useState('en')
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

  function switchLanguage(next: string) {
    if (next === language) return
    setSourceLanguage(language) // remember where we came from
    setLanguage(next)
    setPreview(null)
    drafts.clear()
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

  const selectedLayerId =
    selectedId === undefined ? (layers[0]?.id ?? null) : selectedId
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
    language,
    sourceLanguage,
    layers,
    onApplied: () => void layersQuery.refetch(),
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

  function exportImage() {
    const url = `${API_BASE_URL}/versions/${versionId}/render?language=${language}&fmt=png`
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.blob()
      })
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
      .catch(() => toast.error('Render failed (is the blank image present?)'))
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
        layers={layers}
        language={language}
        editable={!!editable}
        isEditor={isEditor}
        onSwitchVersion={(vid) => navigate(`/editor/${vid}`)}
        onDeleteVersion={deleteCurrentVersion}
        onSwitchLanguage={switchLanguage}
        onTranslate={drafts.start}
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
              language={language}
              sourceLanguage={sourceLanguage}
              selectedLayerId={selectedLayerId}
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
          language={language}
          sourceLanguage={sourceLanguage}
          layers={layers}
          selected={selected}
          selectedLayerId={selectedLayerId}
          drafts={drafts.drafts}
          draftSourceLabel={langLabel(drafts.draftSource)}
          targetLabel={langLabel(language)}
          applying={drafts.applying}
          onSelectLayer={setSelectedId}
          onAddLayer={actions.addLayer}
          onPatchLayer={patchLayer}
          onDeleteLayer={actions.removeLayer}
          onLivePreview={(layerId, lang, t) => setPreview({ layerId, language: lang, t })}
          onTranslationSaved={() => void layersQuery.refetch()}
          onCreateVersion={createNewVersion}
          onStatusChange={() => void ctx.refetch()}
          onApplyDraft={drafts.applyOne}
          onApplyAllDrafts={drafts.applyAll}
          onCloseDrafts={drafts.clear}
        />
      </div>
    </div>
  )
}
