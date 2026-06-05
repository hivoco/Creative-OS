import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * In-place confirmation — a popover anchored to its trigger instead of a
 * page-blocking modal. Drop-in replacement for `ConfirmDialog`.
 */
export function ConfirmPopover({
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  align = 'end',
}: {
  trigger: React.ReactNode
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-64 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
