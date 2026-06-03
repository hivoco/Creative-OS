import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, CloudOff, Loader2, RotateCcw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ColorInput, FieldInput, FieldLabel } from '@/components/ui/Field'
import { QuillEditor } from '@/components/editor/QuillEditor'
import {
  LayerStyleControls,
  type LayerStyle,
} from '@/components/editor/LayerStyleControls'
import {
  readLocalDraft,
  useAutoSave,
  type SaveState,
  type TranslationPayload,
} from '@/components/editor/useAutoSave'
import { deltaToPlainText } from '@/lib/delta'
import type { Delta, LayerTranslation, TextLayer } from '@/types'

interface Props {
  versionId: string
  layer: TextLayer
  language: string
  editable: boolean
  sourceLanguage?: string
  onPatchLayer: (id: string, patch: Partial<TextLayer>) => void
  onDelete: (id: string) => void
  onLivePreview: (layerId: string, language: string, t: Partial<TranslationPayload>) => void
  onTranslationSaved: () => void
}

/** Resolve the effective per-language style: override ?? layer default. */
function styleFromTranslation(layer: TextLayer, t?: LayerTranslation): LayerStyle {
  return {
    font_family: t?.font_family_override ?? layer.font_family,
    font_weight: t?.font_weight_override ?? layer.font_weight,
    italic: t?.italic_override ?? layer.italic,
    font_size: t?.font_size_override ?? layer.base_font_size,
    line_height: t?.line_height_override ?? layer.line_height,
    letter_spacing_pct: t?.letter_spacing_override ?? layer.letter_spacing_pct,
    color: t?.color_override ?? layer.default_color,
  }
}

function payloadFor(delta: Delta, plainText: string, style: LayerStyle): TranslationPayload {
  return {
    content_delta: delta,
    plain_text: plainText,
    font_family_override: style.font_family,
    font_weight_override: style.font_weight,
    italic_override: style.italic,
    font_size_override: style.font_size,
    line_height_override: style.line_height,
    letter_spacing_override: style.letter_spacing_pct,
    color_override: style.color,
  }
}

export function LayerInspector({
  versionId,
  layer,
  language,
  editable,
  sourceLanguage,
  onPatchLayer,
  onDelete,
  onLivePreview,
  onTranslationSaved,
}: Props) {
  // Keyed on `${layer.id}-${language}` by the parent, so lazy initializers run
  // fresh on every layer/language switch — clicking a layer fills the form.
  const serverTranslation = useMemo(
    () => layer.translations.find((t) => t.language_code === language),
    [layer.translations, language],
  )
  // When the target language has no text yet, seed from the source language so
  // the editor shows the text to work from (autosave only fires on real edits).
  const seed = useMemo(
    () =>
      serverTranslation ??
      (sourceLanguage
        ? layer.translations.find((t) => t.language_code === sourceLanguage)
        : undefined),
    [serverTranslation, layer.translations, sourceLanguage],
  )

  const [delta, setDelta] = useState<Delta>(() => seed?.content_delta ?? { ops: [] })
  const [style, setStyle] = useState<LayerStyle>(() =>
    styleFromTranslation(layer, seed),
  )

  const [restore, setRestore] = useState<TranslationPayload | null>(() => {
    const local = readLocalDraft(versionId, layer.id, language)
    if (!local) return null
    const serverTime = serverTranslation
      ? new Date(serverTranslation.last_saved_at).getTime()
      : 0
    return local.savedAt > serverTime + 1000 ? local.payload : null
  })

  const { state, scheduleSave, flush, clearLocalDraft } = useAutoSave({
    versionId,
    layerId: layer.id,
    languageCode: language,
  })

  function persist(nextDelta: Delta, plainText: string, nextStyle: LayerStyle) {
    const payload = payloadFor(nextDelta, plainText, nextStyle)
    onLivePreview(layer.id, language, payload)
    if (editable) scheduleSave(payload)
  }

  function handleText(next: Delta, plainText: string) {
    setDelta(next)
    persist(next, plainText, style)
  }

  function handleStyle(patch: Partial<LayerStyle>) {
    const next = { ...style, ...patch }
    setStyle(next)
    persist(delta, deltaToPlainText(delta), next)
  }

  async function applyRestore() {
    if (!restore) return
    setDelta(restore.content_delta)
    const nextStyle: LayerStyle = {
      font_family: restore.font_family_override ?? layer.font_family,
      font_weight: restore.font_weight_override ?? layer.font_weight,
      italic: restore.italic_override ?? layer.italic,
      font_size: restore.font_size_override ?? layer.base_font_size,
      line_height: restore.line_height_override ?? layer.line_height,
      letter_spacing_pct: restore.letter_spacing_override ?? layer.letter_spacing_pct,
      color: restore.color_override ?? layer.default_color,
    }
    setStyle(nextStyle)
    await flush(restore)
    clearLocalDraft()
    setRestore(null)
    onLivePreview(layer.id, language, restore)
    onTranslationSaved()
    toast.success('Draft restored')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{layer.layer_key}</p>
          <SaveBadge state={state} />
        </div>
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onDelete(layer.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {restore && (
        <div className="rounded-md border border-foreground/30 bg-accent/60 p-3 text-sm">
          <p className="mb-1 font-medium">You have unsaved changes — restore?</p>
          <p className="mb-2 text-xs text-muted-foreground">
            “{deltaToPlainText(restore.content_delta).slice(0, 60)}”
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyRestore}>
              <RotateCcw className="mr-1 h-3 w-3" /> Restore
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearLocalDraft()
                setRestore(null)
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <FieldLabel>Text · {language}</FieldLabel>
        <QuillEditor
          key={`${layer.id}-${language}`}
          value={delta}
          onChange={handleText}
          placeholder={editable ? 'Type here…' : 'Read-only'}
          fontFamily={style.font_family}
          autoFocus={editable}
        />
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          Text style
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-accent-foreground">
            {language} only
          </span>
        </p>
        <LayerStyleControls style={style} editable={editable} onChange={handleStyle} />
      </div>

      {/* Layer-level (shared across languages) */}
      <div className="space-y-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Layer (all languages)
        </p>
        <div className="space-y-1.5">
          <FieldLabel>Layer key</FieldLabel>
          <FieldInput
            defaultValue={layer.layer_key}
            disabled={!editable}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== layer.layer_key) onPatchLayer(layer.id, { layer_key: v })
            }}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Background (optional)</FieldLabel>
          <div className="flex items-center gap-2">
            <ColorInput
              value={layer.default_bg_color ?? ''}
              onChange={(v) => onPatchLayer(layer.id, { default_bg_color: v || null })}
            />
            {layer.default_bg_color && editable && (
              <button
                type="button"
                onClick={() => onPatchLayer(layer.id, { default_bg_color: null })}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SaveBadge({ state }: { state: SaveState }) {
  const map = {
    idle: { text: 'Saved', icon: <Check className="h-3 w-3" /> },
    dirty: { text: 'Editing…', icon: <Loader2 className="h-3 w-3" /> },
    saving: { text: 'Saving…', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    saved: { text: 'Saved', icon: <Check className="h-3 w-3" /> },
    error: { text: 'Offline (saved locally)', icon: <CloudOff className="h-3 w-3" /> },
  }[state]
  return (
    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
      {map.icon}
      {map.text}
    </span>
  )
}
