import { useState } from 'react'
import { toast } from 'sonner'

import type { TranslationDraft } from '@/components/editor/TranslateDraftsPanel'
import { saveTranslation, translateTexts } from '@/lib/services'
import { deltaToPlainText, plainTextToDelta } from '@/lib/delta'
import { LANGUAGE_FONT, langLabel } from '@/lib/constants'
import type { TextLayer } from '@/types'

/**
 * Translation-drafts workflow. Adding a language always translates from the
 * version's *original* (`sourceLang`) — never from whatever variant the user is
 * currently viewing — so translations don't drift by being made from another
 * translation. `start(target)` takes the source text of every layer, converts it
 * `sourceLang` → `target`, and produces reviewable drafts. Applying saves the
 * result under `target` with a script-appropriate font, carrying the source
 * layer's other style.
 */
export function useTranslateDrafts(params: {
  /** The version's original language — translations are always made from this. */
  sourceLang: string
  layers: TextLayer[]
  /** Called after drafts are saved, with the language they were saved under. */
  onApplied: (target: string) => void
}) {
  const { sourceLang, layers, onApplied } = params
  const [drafts, setDrafts] = useState<TranslationDraft[] | null>(null)
  const [applying, setApplying] = useState(false)
  // The language being added — set when start() runs, read when applying.
  const [targetLang, setTargetLang] = useState('')

  // The original text we translate from: the source language, else any
  // translation that has content (so a version authored in another language
  // still works), else the first row.
  function sourceTranslation(l: TextLayer) {
    return (
      l.translations.find((t) => t.language_code === sourceLang) ??
      l.translations.find((t) => deltaToPlainText(t.content_delta).trim()) ??
      l.translations[0]
    )
  }

  async function start(target: string) {
    if (target === sourceLang) {
      toast.info('That language is already the source')
      return
    }
    setTargetLang(target)
    const items = layers
      .map((l) => {
        const src = sourceTranslation(l)
        return {
          layerId: l.id,
          layerKey: l.layer_key,
          sourceText: src ? deltaToPlainText(src.content_delta) : '',
        }
      })
      .filter((i) => i.sourceText.trim())

    if (!items.length) {
      toast.info('Add some text to a layer before translating')
      return
    }
    try {
      toast.loading('Translating…', { id: 'tr' })
      const translated = await translateTexts(
        items.map((i) => i.sourceText),
        langLabel(sourceLang),
        langLabel(target),
      )
      setDrafts(items.map((i, idx) => ({ ...i, translatedText: translated[idx] ?? '' })))
      toast.success('Review the translation', { id: 'tr' })
    } catch {
      toast.error('Translation failed', { id: 'tr' })
    }
  }

  function payloadFor(layerId: string, translatedText: string) {
    const layer = layers.find((l) => l.id === layerId)
    const src = layer ? sourceTranslation(layer) : undefined
    return {
      content_delta: plainTextToDelta(translatedText),
      plain_text: translatedText,
      font_family_override: LANGUAGE_FONT[targetLang] ?? src?.font_family_override ?? null,
      font_weight_override: src?.font_weight_override ?? null,
      italic_override: src?.italic_override ?? null,
      font_size_override: src?.font_size_override ?? null,
      line_height_override: src?.line_height_override ?? null,
      letter_spacing_override: src?.letter_spacing_override ?? null,
      color_override: src?.color_override ?? null,
    }
  }

  function editDraft(layerId: string, text: string) {
    setDrafts(
      (prev) =>
        prev?.map((d) => (d.layerId === layerId ? { ...d, translatedText: text } : d)) ??
        null,
    )
  }

  function skip(layerId: string) {
    setDrafts((prev) => {
      const next = prev?.filter((d) => d.layerId !== layerId) ?? null
      return next && next.length ? next : null
    })
  }

  async function applyOne(layerId: string) {
    const draft = drafts?.find((d) => d.layerId === layerId)
    if (!draft) return
    setApplying(true)
    try {
      await saveTranslation(layerId, targetLang, payloadFor(layerId, draft.translatedText))
      setDrafts((prev) => prev?.filter((d) => d.layerId !== layerId) ?? null)
      onApplied(targetLang)
    } catch {
      toast.error('Could not apply')
    } finally {
      setApplying(false)
    }
  }

  async function applyAll() {
    if (!drafts) return
    setApplying(true)
    // Apply each independently so one failure doesn't abort the rest; keep any
    // that failed in the panel so they can be retried.
    const failed: TranslationDraft[] = []
    for (const d of drafts) {
      try {
        await saveTranslation(d.layerId, targetLang, payloadFor(d.layerId, d.translatedText))
      } catch {
        failed.push(d)
      }
    }
    setDrafts(failed.length ? failed : null)
    onApplied(targetLang)
    setApplying(false)
    if (failed.length) toast.error(`Could not apply ${failed.length} layer(s)`)
    else toast.success('Applied translation')
  }

  return {
    drafts,
    applying,
    targetLang,
    start,
    editDraft,
    skip,
    applyOne,
    applyAll,
    clear: () => setDrafts(null),
  }
}
