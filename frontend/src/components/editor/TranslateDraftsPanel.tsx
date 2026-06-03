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
  onApply: (layerId: string) => void
  onApplyAll: () => void
  onClose: () => void
}

export function TranslateDraftsPanel({
  drafts,
  sourceLabel,
  targetLabel,
  applying,
  onApply,
  onApplyAll,
  onClose,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-foreground/30 bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Review translation</h2>
          <p className="text-[11px] text-muted-foreground">
            {sourceLabel} → {targetLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Button
        size="sm"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={applying || !drafts.length}
        onClick={onApplyAll}
      >
        {applying ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <CheckCheck className="mr-1 h-4 w-4" />
        )}
        Apply all ({drafts.length})
      </Button>

      <div className="space-y-2">
        {drafts.map((d) => (
          <div key={d.layerId} className="rounded-md border border-border bg-background p-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {d.layerKey}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">{d.sourceText}</p>
            <p className="mt-1 text-sm font-medium">{d.translatedText}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 w-full"
              disabled={applying}
              onClick={() => onApply(d.layerId)}
            >
              <Check className="mr-1 h-3 w-3" /> Apply
            </Button>
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
