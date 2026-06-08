import { useMemo, useState } from 'react'
import { Check, CloudOff, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmPopover } from '@/components/ui/confirm-popover'
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
import type { Delta, TextLayer } from '@/types'

interface Props {
  versionId: string
  layer: TextLayer
  language: string
  editable: boolean
  sourceLanguage?: string
  onPatchLayer: (id: string, patch: Partial<TextLayer>) => void
  onDelete: (id: string) => void
  onLivePreview: (layerId: string, language: string, t: Partial<TranslationPayload>) => void
}

/** The per-language override fields shared by a saved translation and a draft. */
type StyleOverrides = Pick<
  TranslationPayload,
  | 'font_family_override'
  | 'font_weight_override'
  | 'italic_override'
  | 'font_size_override'
  | 'line_height_override'
  | 'letter_spacing_override'
  | 'color_override'
>

/** Resolve the effective per-language style: override ?? layer default. */
function styleFromOverrides(layer: TextLayer, o?: StyleOverrides | null): LayerStyle {
  return {
    font_family: o?.font_family_override ?? layer.font_family,
    font_weight: o?.font_weight_override ?? layer.font_weight,
    italic: o?.italic_override ?? layer.italic,
    font_size: o?.font_size_override ?? layer.base_font_size,
    line_height: o?.line_height_override ?? layer.line_height,
    letter_spacing_pct: o?.letter_spacing_override ?? layer.letter_spacing_pct,
    color: o?.color_override ?? layer.default_color,
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
}: Props) {
  // Keyed on `${layer.id}-${language}` by the parent, so lazy initializers run
  // fresh on every layer/language switch — clicking a layer fills the form.
  const serverTranslation = useMemo(
    () => layer.translations.find((t) => t.language_code === language),
    [layer.translations, language],
  )
  // When this language has no text yet, seed from any translation that has
  // content so the editor shows the text to work from (autosave only fires on
  // real edits).
  const seed = useMemo(
    () =>
      serverTranslation ??
      (sourceLanguage
        ? layer.translations.find((t) => t.language_code === sourceLanguage)
        : undefined) ??
      layer.translations.find((t) => deltaToPlainText(t.content_delta).trim()),
    [serverTranslation, layer.translations, sourceLanguage],
  )

  // A local draft survives only when edits never reached the DB (it's cleared
  // on every successful save), so its mere presence means genuinely-unsaved
  // work — seed straight from it, no prompt. Managers can't edit, so skip them.
  const localDraft = useMemo(
    () => (editable ? readLocalDraft(versionId, layer.id, language) : null),
    [editable, versionId, layer.id, language],
  )

  const [delta, setDelta] = useState<Delta>(
    () => localDraft?.payload.content_delta ?? seed?.content_delta ?? { ops: [] },
  )
  const [style, setStyle] = useState<LayerStyle>(() =>
    styleFromOverrides(layer, localDraft?.payload ?? seed),
  )

  const { state, scheduleSave } = useAutoSave({
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{layer.layer_key}</p>
          <SaveBadge state={state} />
        </div>
        {editable && (
          <ConfirmPopover
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                aria-label={`Delete ${layer.layer_key} layer`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
            title={`Delete “${layer.layer_key}” layer?`}
            description="Removes this layer and its text in every language. You can undo with ⌘/Ctrl+Z."
            onConfirm={() => onDelete(layer.id)}
          />
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>Text · {language}</FieldLabel>
        <QuillEditor
          key={`${layer.id}-${language}`}
          value={delta}
          onChange={handleText}
          placeholder={editable ? 'Type here…' : 'Read-only'}
          fontFamily={style.font_family}
          autoFocus={editable}
          readOnly={!editable}
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
              disabled={!editable}
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
