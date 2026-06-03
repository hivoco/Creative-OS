import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NumberField({
  label,
  value,
  onChange,
  disabled,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  step?: number
  suffix?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value || '0'))}
          className="h-8 pr-7 text-sm"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  disabled,
  allowClear,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
  allowClear?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={(value ?? '#000000').slice(0, 7)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5 disabled:opacity-50"
        />
        <Input
          value={value ?? ''}
          disabled={disabled}
          placeholder="none"
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 text-sm"
        />
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        )}
      </div>
    </div>
  )
}
