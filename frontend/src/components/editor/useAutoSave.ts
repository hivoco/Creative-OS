import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

import { saveTranslation } from '@/lib/services'
import type { Delta, LayerTranslation, TextLayer } from '@/types'

/**
 * Fold a just-saved translation back into the cached layers list so the canvas
 * reads fresh content even for layers that aren't the active live overlay. The
 * `['layers', versionId]` cache was previously write-once, so a saved edit only
 * survived in the in-memory overlay — splicing here keeps cache and overlay in
 * sync without a network refetch.
 */
export function spliceTranslation(
  queryClient: QueryClient,
  versionId: string,
  layerId: string,
  languageCode: string,
  saved: LayerTranslation,
) {
  queryClient.setQueryData<TextLayer[]>(['layers', versionId], (old) =>
    old?.map((l) =>
      l.id !== layerId
        ? l
        : {
            ...l,
            translations: [
              ...l.translations.filter((tr) => tr.language_code !== languageCode),
              saved,
            ],
          },
    ),
  )
}

/**
 * The first content-bearing save pins the version's original language on the
 * server. That value lives in the ['version', versionId] query, which a text
 * save never touches — so refetch it once, while it's still unset, so the editor
 * picks up the authoritative original (the `· original` tag, translation source,
 * export). A no-op once pinned, so it never refetches on later keystrokes.
 */
function refreshPinnedOriginal(
  queryClient: QueryClient,
  versionId: string,
  saved: LayerTranslation,
) {
  if (!saved.plain_text?.trim()) return
  const ctx = queryClient.getQueryData<{ version?: { source_language?: string | null } }>([
    'version',
    versionId,
  ])
  if (ctx && !ctx.version?.source_language) {
    void queryClient.invalidateQueries({ queryKey: ['version', versionId] })
  }
}

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

export interface RecoverableDraft {
  layerId: string
  lang: string
  payload: TranslationPayload
}

/**
 * Every unsaved draft stored for a version. The owning inspector only mounts for
 * the selected layer, so per-layer recovery misses drafts for layers the user
 * hasn't clicked — this enumerates them all so a page-load pass can recover the
 * lot. Read-only (never mutates localStorage while iterating).
 */
export function listLocalDrafts(versionId: string): RecoverableDraft[] {
  const prefix = `draft_${versionId}_`
  const out: RecoverableDraft[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    // Remainder is `${layerId}_${lang}`; lang never contains '_', so split last.
    const rest = key.slice(prefix.length)
    const cut = rest.lastIndexOf('_')
    if (cut < 0) continue
    const layerId = rest.slice(0, cut)
    const lang = rest.slice(cut + 1)
    try {
      const draft = JSON.parse(localStorage.getItem(key) as string) as LocalDraft
      if (draft?.payload) out.push({ layerId, lang, payload: draft.payload })
    } catch {
      // Skip malformed entries.
    }
  }
  return out
}

/** Drop a draft from localStorage without saving (e.g. its layer was deleted). */
export function discardLocalDraft(versionId: string, layerId: string, lang: string) {
  localStorage.removeItem(draftKey(versionId, layerId, lang))
}

/**
 * Push one recovered draft to the DB and reconcile the cache, then clear the
 * local copy. Best-effort: on failure the draft is kept for a later retry.
 */
export async function persistRecoveredDraft(
  queryClient: QueryClient,
  versionId: string,
  draft: RecoverableDraft,
): Promise<void> {
  try {
    const saved = await saveTranslation(draft.layerId, draft.lang, draft.payload)
    spliceTranslation(queryClient, versionId, draft.layerId, draft.lang, saved)
    refreshPinnedOriginal(queryClient, versionId, saved)
    localStorage.removeItem(draftKey(versionId, draft.layerId, draft.lang))
  } catch {
    // Keep the draft on disk; the next load will try again.
  }
}

/**
 * Two-layer auto-save (reference.md §5):
 *   Layer 1 — localStorage on every change (instant, survives refresh).
 *   Layer 2 — debounced PUT to the DB 1.5s after editing stops.
 *
 * The local copy is cleared the moment the DB save lands, so any draft that
 * survives to the next mount is, by definition, edits that never reached the
 * server — which the inspector then restores silently (no prompt).
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
  const queryClient = useQueryClient()
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest payload still waiting on the debounce, so we can flush it on unmount
  // (e.g. when the user switches layer/language before the 1.5s elapses).
  const pending = useRef<TranslationPayload | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current) {
        void saveTranslation(layerId, languageCode, pending.current)
          .then((saved) => {
            spliceTranslation(queryClient, versionId, layerId, languageCode, saved)
            refreshPinnedOriginal(queryClient, versionId, saved)
            localStorage.removeItem(draftKey(versionId, layerId, languageCode))
          })
          .catch(() => {})
      }
    }
  }, [queryClient, versionId, layerId, languageCode])

  const flush = useCallback(
    async (payload: TranslationPayload) => {
      setState('saving')
      try {
        const saved = await saveTranslation(layerId, languageCode, payload)
        pending.current = null
        // Keep the cached layers list in step with the DB so the canvas stays
        // correct even after the live overlay is gone.
        spliceTranslation(queryClient, versionId, layerId, languageCode, saved)
        refreshPinnedOriginal(queryClient, versionId, saved)
        // DB now holds this content → the local draft is no longer "unsaved".
        localStorage.removeItem(draftKey(versionId, layerId, languageCode))
        setState('saved')
      } catch {
        setState('error')
      }
    },
    [queryClient, versionId, layerId, languageCode],
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
