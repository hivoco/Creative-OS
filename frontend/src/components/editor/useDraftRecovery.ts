import { useEffect, useRef } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import {
  discardLocalDraft,
  listLocalDrafts,
  persistRecoveredDraft,
  type RecoverableDraft,
} from '@/components/editor/useAutoSave'
import type { TextLayer } from '@/types'

/**
 * One-shot, page-load recovery of unsaved localStorage drafts for a version.
 *
 * The inspector only mounts for the selected layer, so per-layer recovery alone
 * would restore a draft only for the layer the user happens to click. This
 * sweeps EVERY draft for the version once the layers have loaded: it hands them
 * to `onSeed` (to show on the canvas immediately) and flushes each to the DB, so
 * nothing stays invisibly unsaved. Drafts whose layer no longer exists are
 * discarded. Runs exactly once per versionId.
 */
export function useDraftRecovery(params: {
  versionId: string
  editable: boolean
  /** The server layers (react-query data), used to drop drafts for gone layers. */
  serverLayers: TextLayer[] | undefined
  queryClient: QueryClient
  onSeed: (drafts: RecoverableDraft[]) => void
}) {
  const { versionId, editable, serverLayers, queryClient, onSeed } = params
  const done = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!editable || !serverLayers?.length) return
    if (done.current.has(versionId)) return
    done.current.add(versionId)

    const drafts = listLocalDrafts(versionId)
    if (!drafts.length) return
    const liveIds = new Set(serverLayers.map((l) => l.id))
    const valid = drafts.filter((d) => liveIds.has(d.layerId))
    drafts
      .filter((d) => !liveIds.has(d.layerId))
      .forEach((d) => discardLocalDraft(versionId, d.layerId, d.lang))
    if (!valid.length) return

    onSeed(valid)
    for (const d of valid) void persistRecoveredDraft(queryClient, versionId, d)
  }, [editable, serverLayers, versionId, queryClient, onSeed])
}
