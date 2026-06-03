import { useCallback, useEffect, useRef, useState } from 'react'

import { saveTranslation } from '@/lib/services'
import type { Delta } from '@/types'

const DEBOUNCE_MS = 1500

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface TranslationPayload {
  content_delta: Delta
  plain_text: string
  font_family_override: string | null
  font_weight_override: number | null
  italic_override: boolean | null
  font_size_override: number | null
  line_height_override: number | null
  letter_spacing_override: number | null
  color_override: string | null
}

interface LocalDraft {
  payload: TranslationPayload
  savedAt: number
}

function draftKey(versionId: string, layerId: string, lang: string) {
  return `draft_${versionId}_${layerId}_${lang}`
}

export function readLocalDraft(
  versionId: string,
  layerId: string,
  lang: string,
): LocalDraft | null {
  const raw = localStorage.getItem(draftKey(versionId, layerId, lang))
  if (!raw) return null
  try {
    return JSON.parse(raw) as LocalDraft
  } catch {
    return null
  }
}

/**
 * Two-layer auto-save (reference.md §5):
 *   Layer 1 — localStorage on every change (instant, survives refresh).
 *   Layer 2 — debounced PUT to the DB 1.5s after editing stops.
 *
 * The owning inspector remounts per layer/language (keyed), so this hook starts
 * fresh each time.
 */
export function useAutoSave(params: {
  versionId: string
  layerId: string
  languageCode: string
}) {
  const { versionId, layerId, languageCode } = params
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest payload still waiting on the debounce, so we can flush it on unmount
  // (e.g. when the user switches layer/language before the 1.5s elapses).
  const pending = useRef<TranslationPayload | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current) {
        void saveTranslation(layerId, languageCode, pending.current).catch(() => {})
      }
    }
  }, [layerId, languageCode])

  const flush = useCallback(
    async (payload: TranslationPayload) => {
      setState('saving')
      try {
        await saveTranslation(layerId, languageCode, payload)
        pending.current = null
        setState('saved')
      } catch {
        setState('error')
      }
    },
    [layerId, languageCode],
  )

  const scheduleSave = useCallback(
    (payload: TranslationPayload) => {
      // Layer 1: instant localStorage write.
      localStorage.setItem(
        draftKey(versionId, layerId, languageCode),
        JSON.stringify({ payload, savedAt: Date.now() }),
      )
      pending.current = payload
      setState('dirty')

      // Layer 2: debounced DB save.
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(payload), DEBOUNCE_MS)
    },
    [versionId, layerId, languageCode, flush],
  )

  const clearLocalDraft = useCallback(() => {
    localStorage.removeItem(draftKey(versionId, layerId, languageCode))
  }, [versionId, layerId, languageCode])

  return { state, scheduleSave, flush, clearLocalDraft }
}
