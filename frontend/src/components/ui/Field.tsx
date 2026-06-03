import * as React from 'react'

import { cn } from '@/lib/utils'

export const FieldLabel = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn(
      'text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
      className,
    )}
    {...props}
  />
)

export const FieldInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs',
      'outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/40',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
FieldInput.displayName = 'FieldInput'

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs',
      'outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/40',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'

export const Slider = ({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    type="range"
    className={cn(
      'h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground',
      className,
    )}
    {...props}
  />
)

export const ColorInput = ({
  value,
  onChange,
  presets,
  id,
}: {
  value: string
  onChange: (next: string) => void
  presets?: readonly string[]
  id?: string
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <label
      htmlFor={id}
      className="relative size-9 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
      style={{ backgroundColor: value }}
    >
      <input
        id={id}
        type="color"
        value={(value || '#000000').slice(0, 7)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
    <FieldInput
      value={(value || '').toUpperCase()}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="w-28 font-mono uppercase"
    />
    {presets && presets.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Use color ${preset}`}
            onClick={() => onChange(preset)}
            className={cn(
              'size-6 rounded-md border border-border shadow-xs transition-transform hover:scale-110',
              value.toLowerCase() === preset.toLowerCase() && 'ring-2 ring-ring',
            )}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    )}
  </div>
)
