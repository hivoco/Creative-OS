import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export const Tooltip = ({
  content,
  children,
  side = 'top',
  className,
}: TooltipProps) => (
  <span className={cn('group relative inline-flex w-full', className)}>
    {children}
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-md ring-1 ring-border opacity-0 scale-95 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100',
        side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
    >
      {content}
    </span>
  </span>
)
