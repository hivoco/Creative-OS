import { useRef } from 'react'
import { toast } from 'sonner'

import type { LayerBox } from '@/components/editor/TemplateCanvas'
import { createLayer, deleteLayer, saveTranslation } from '@/lib/services'
import type { TextLayer } from '@/types'

type UndoEntry =
  | { kind: 'created'; layerId: string }
  | { kind: 'deleted'; layer: TextLayer }
  | { kind: 'geometry'; layerId: string; before: LayerBox }

function layerCreateInput(src: TextLayer, key: string, offset: boolean) {
  return {
    layer_key: key,
    x_percent: Math.min(95, src.x_percent + (offset ? 3 : 0)),
    y_percent: Math.min(95, src.y_percent + (offset ? 3 : 0)),
    width_percent: src.width_percent,
    height_percent: src.height_percent,
    font_family: src.font_family,
    font_weight: src.font_weight,
    italic: src.italic,
    base_font_size: src.base_font_size,
    line_height: src.line_height,
    letter_spacing_pct: src.letter_spacing_pct,
    text_align: src.text_align,
    default_color: src.default_color,
    default_bg_color: src.default_bg_color,
  }
}

function translationPayload(t: TextLayer['translations'][number]) {
  return {
    content_delta: t.content_delta,
    plain_text: t.plain_text,
    font_family_override: t.font_family_override,
    font_weight_override: t.font_weight_override,
    italic_override: t.italic_override,
    font_size_override: t.font_size_override,
    line_height_override: t.line_height_override,
    letter_spacing_override: t.letter_spacing_override,
    color_override: t.color_override,
  }
}

/**
 * Layer add/remove/copy/paste/duplicate + an undo stack, shared by the toolbar,
 * sidebar and keyboard shortcuts. Undo covers add / paste / duplicate / delete
 * / move / resize (text edits are undone by Quill itself while focused).
 */
export function useLayerActions(params: {
  versionId: string
  layers: TextLayer[]
  selectedId: string | null | undefined
  refetch: () => Promise<unknown>
  selectLayer: (id: string | null) => void
  patchLayer: (id: string, patch: Partial<TextLayer>) => void
}) {
  const { versionId, layers, selectedId, refetch, selectLayer, patchLayer } = params
  const clipboard = useRef<TextLayer | null>(null)
  const undoStack = useRef<UndoEntry[]>([])

  function uniqueKey(base: string): string {
    const existing = new Set(layers.map((l) => l.layer_key))
    if (!existing.has(base)) return base
    let n = 2
    while (existing.has(`${base}_${n}`)) n += 1
    return `${base}_${n}`
  }

  async function recreate(src: TextLayer, offset: boolean): Promise<string> {
    const created = await createLayer(versionId, layerCreateInput(src, uniqueKey(src.layer_key), offset))
    for (const t of src.translations) {
      await saveTranslation(created.id, t.language_code, translationPayload(t))
    }
    await refetch()
    selectLayer(created.id)
    return created.id
  }

  async function addLayer(key: string) {
    try {
      const created = await createLayer(versionId, {
        layer_key: uniqueKey(key),
        x_percent: 10,
        y_percent: 10,
        width_percent: 80,
        height_percent: 12,
        base_font_size: 48,
      })
      undoStack.current.push({ kind: 'created', layerId: created.id })
      await refetch()
      selectLayer(created.id)
    } catch {
      toast.error('Could not add layer')
    }
  }

  async function removeLayer(id: string) {
    const layer = layers.find((l) => l.id === id)
    try {
      if (layer) undoStack.current.push({ kind: 'deleted', layer })
      await deleteLayer(id)
      if (selectedId === id) selectLayer(null)
      await refetch()
    } catch {
      toast.error('Could not delete layer')
    }
  }

  function copy(layer: TextLayer | null) {
    if (!layer) return
    clipboard.current = layer
    toast.success('Layer copied')
  }

  async function cloneFrom(src: TextLayer | null) {
    if (!src) return
    try {
      const id = await recreate(src, true)
      undoStack.current.push({ kind: 'created', layerId: id })
    } catch {
      toast.error('Could not paste layer')
    }
  }

  const paste = () => cloneFrom(clipboard.current)

  function commitGeometry(id: string, before: LayerBox) {
    undoStack.current.push({ kind: 'geometry', layerId: id, before })
  }

  async function undo() {
    const entry = undoStack.current.pop()
    if (!entry) {
      toast.info('Nothing to undo')
      return
    }
    try {
      if (entry.kind === 'created') {
        await deleteLayer(entry.layerId)
        await refetch()
      } else if (entry.kind === 'deleted') {
        await recreate(entry.layer, false)
      } else {
        patchLayer(entry.layerId, entry.before)
        selectLayer(entry.layerId)
      }
    } catch {
      toast.error('Undo failed')
    }
  }

  return { addLayer, removeLayer, copy, paste, cloneFrom, commitGeometry, undo }
}
