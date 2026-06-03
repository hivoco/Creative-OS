import { useState } from 'react'
import { toast } from 'sonner'

import type { TranslationDraft } from '@/components/editor/TranslateDraftsPanel'
import { saveTranslation, translateTexts } from '@/lib/services'
import { deltaToPlainText, plainTextToDelta } from '@/lib/delta'
import { LANGUAGE_FONT, langLabel } from '@/lib/constants'
import type { TextLayer } from '@/types'

/**
 * Translation-drafts workflow: translate source→current language into reviewable
 * drafts (no auto-apply), then apply per-layer or all at once with a
 * script-appropriate font, carrying the source layer's other style.
 */
export function useTranslateDrafts(params: {
  language: string
  sourceLanguage: string
  layers: TextLayer[]
  onApplied: () => void
}) {
  const { language, sourceLanguage, layers, onApplied } = params
  const [drafts, setDrafts] = useState<TranslationDraft[] | null>(null)
  const [draftSource, setDraftSource] = useState('en')
  const [applying, setApplying] = useState(false)

  async function start() {
    if (language === sourceLanguage) {
      toast.info('Switch to a different language to translate into it')
      return
    }
    const items = layers
      .map((l) => {
        const src = l.translations.find((t) => t.language_code === sourceLanguage)
        return {
          layerId: l.id,
          layerKey: l.layer_key,
          sourceText: src ? deltaToPlainText(src.content_delta) : '',
        }
      })
      .filter((i) => i.sourceText.trim())

    if (!items.length) {
      toast.info(`No ${langLabel(sourceLanguage)} text to translate from`)
      return
    }
    try {
      toast.loading('Translating…', { id: 'tr' })
      const translated = await translateTexts(
        items.map((i) => i.sourceText),
        langLabel(sourceLanguage),
        langLabel(language),
      )
      setDraftSource(sourceLanguage)
      setDrafts(items.map((i, idx) => ({ ...i, translatedText: translated[idx] ?? '' })))
      toast.success('Review the translation', { id: 'tr' })
    } catch {
      toast.error('Translation failed', { id: 'tr' })
    }
  }

  function payloadFor(layerId: string, translatedText: string) {
    const layer = layers.find((l) => l.id === layerId)
    const src = layer?.translations.find((t) => t.language_code === draftSource)
    return {
      content_delta: plainTextToDelta(translatedText),
      plain_text: translatedText,
      font_family_override: LANGUAGE_FONT[language] ?? src?.font_family_override ?? null,
      font_weight_override: src?.font_weight_override ?? null,
      italic_override: src?.italic_override ?? null,
      font_size_override: src?.font_size_override ?? null,
      line_height_override: src?.line_height_override ?? null,
      letter_spacing_override: src?.letter_spacing_override ?? null,
      color_override: src?.color_override ?? null,
    }
  }

  async function applyOne(layerId: string) {
    const draft = drafts?.find((d) => d.layerId === layerId)
    if (!draft) return
    setApplying(true)
    try {
      await saveTranslation(layerId, language, payloadFor(layerId, draft.translatedText))
      setDrafts((prev) => prev?.filter((d) => d.layerId !== layerId) ?? null)
      onApplied()
    } catch {
      toast.error('Could not apply')
    } finally {
      setApplying(false)
    }
  }

  async function applyAll() {
    if (!drafts) return
    setApplying(true)
    try {
      for (const d of drafts) {
        await saveTranslation(d.layerId, language, payloadFor(d.layerId, d.translatedText))
      }
      setDrafts(null)
      onApplied()
      toast.success('Applied translation')
    } catch {
      toast.error('Could not apply all')
    } finally {
      setApplying(false)
    }
  }

  return {
    drafts,
    draftSource,
    applying,
    start,
    applyOne,
    applyAll,
    clear: () => setDrafts(null),
  }
}
