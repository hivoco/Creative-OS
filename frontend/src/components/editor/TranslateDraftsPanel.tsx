import { Check, CheckCheck, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface TranslationDraft {
  layerId: string
  layerKey: string
  sourceText: string
  translatedText: string
}

interface Props {
  drafts: TranslationDraft[]
  sourceLabel: string
  targetLabel: string
  applying: boolean
  onEdit: (layerId: string, text: string) => void
  onSkip: (layerId: string) => void
  onApply: (layerId: string) => void
  onApplyAll: () => void
  onClose: () => void
}

export function TranslateDraftsPanel({
  drafts,
  sourceLabel,
  targetLabel,
  applying,
  onEdit,
  onSkip,
  onApply,
  onApplyAll,
  onClose,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-foreground/30 bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            Review {drafts.length} translation{drafts.length === 1 ? '' : 's'}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {sourceLabel} → {targetLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={applying || !drafts.length}
            onClick={onApplyAll}
          >
            {applying ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-1 h-4 w-4" />
            )}
            Apply all
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {drafts.map((d) => (
          <div key={d.layerId} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {d.layerKey}
              </p>
              <p className="truncate text-xs text-muted-foreground line-through">
                {d.sourceText}
              </p>
            </div>
            <textarea
              value={d.translatedText}
              onChange={(e) => onEdit(d.layerId, e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/40"
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={applying}
                onClick={() => onSkip(d.layerId)}
              >
                Skip
              </Button>
              <Button
                size="sm"
                className="h-7 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={applying || !d.translatedText.trim()}
                onClick={() => onApply(d.layerId)}
              >
                <Check className="mr-1 h-3 w-3" /> Apply
              </Button>
            </div>
          </div>
        ))}
        {!drafts.length && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            All translations applied.
          </p>
        )}
      </div>
    </div>
  )
}
