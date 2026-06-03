import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AddLayerDialog } from '@/components/editor/AddLayerDialog'
import { LayerInspector } from '@/components/editor/LayerInspector'
import { ReviewPanel } from '@/components/editor/ReviewPanel'
import {
  TranslateDraftsPanel,
  type TranslationDraft,
} from '@/components/editor/TranslateDraftsPanel'
import type { TranslationPayload } from '@/components/editor/useAutoSave'
import type { TextLayer } from '@/types'

interface Props {
  versionId: string
  versionStatus?: string
  isEditor: boolean
  editable: boolean
  language: string
  sourceLanguage: string
  layers: TextLayer[]
  selected: TextLayer | null
  selectedLayerId: string | null
  drafts: TranslationDraft[] | null
  draftSourceLabel: string
  targetLabel: string
  applying: boolean
  onSelectLayer: (id: string) => void
  onAddLayer: (key: string) => void
  onPatchLayer: (id: string, patch: Partial<TextLayer>) => void
  onDeleteLayer: (id: string) => void
  onLivePreview: (layerId: string, language: string, t: Partial<TranslationPayload>) => void
  onTranslationSaved: () => void
  onCreateVersion: () => void
  onStatusChange: () => void
  onApplyDraft: (layerId: string) => void
  onApplyAllDrafts: () => void
  onCloseDrafts: () => void
}

export function EditorSidebar(props: Props) {
  const {
    versionId,
    versionStatus,
    isEditor,
    editable,
    language,
    sourceLanguage,
    layers,
    selected,
    selectedLayerId,
    drafts,
    draftSourceLabel,
    targetLabel,
    applying,
    onSelectLayer,
    onAddLayer,
    onPatchLayer,
    onDeleteLayer,
    onLivePreview,
    onTranslationSaved,
    onCreateVersion,
    onStatusChange,
    onApplyDraft,
    onApplyAllDrafts,
    onCloseDrafts,
  } = props

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {versionStatus && (
            <>
              <ReviewPanel
                versionId={versionId}
                status={versionStatus}
                role={isEditor ? 'editor' : 'manager'}
                layers={layers}
                selectedLayerId={selectedLayerId}
                language={language}
                onStatusChange={onStatusChange}
                onCreateVersion={onCreateVersion}
              />
              <Separator />
            </>
          )}

          {drafts && (
            <>
              <TranslateDraftsPanel
                drafts={drafts}
                sourceLabel={draftSourceLabel}
                targetLabel={targetLabel}
                applying={applying}
                onApply={onApplyDraft}
                onApplyAll={onApplyAllDrafts}
                onClose={onCloseDrafts}
              />
              <Separator />
            </>
          )}

          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Layers
              <Badge variant="secondary">{layers.length}</Badge>
            </h2>
            {editable && <AddLayerDialog onAdd={onAddLayer} />}
          </div>

          <div className="space-y-1">
            {layers.map((l) => (
              <button
                key={l.id}
                onClick={() => onSelectLayer(l.id)}
                className={
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ' +
                  (l.id === selectedLayerId
                    ? 'bg-accent font-medium'
                    : 'hover:bg-muted')
                }
              >
                <span className="truncate">{l.layer_key}</span>
              </button>
            ))}
            {!layers.length && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No layers yet. {editable && 'Add one to start placing text.'}
              </p>
            )}
          </div>

          {selected && (
            <>
              <Separator />
              <LayerInspector
                key={`${selected.id}-${language}`}
                versionId={versionId}
                layer={selected}
                language={language}
                sourceLanguage={sourceLanguage}
                editable={editable}
                onPatchLayer={onPatchLayer}
                onDelete={onDeleteLayer}
                onLivePreview={onLivePreview}
                onTranslationSaved={onTranslationSaved}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
