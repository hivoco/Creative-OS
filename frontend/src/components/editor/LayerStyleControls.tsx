import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ColorInput,
  FieldLabel,
  NativeSelect,
  Slider,
} from '@/components/ui/Field'
import {
  COLOR_PRESETS,
  FONT_OPTIONS,
  FONT_SIZE_PX_OPTIONS,
  FONT_WEIGHTS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

/** Per-language text style. Each language can carry its own values. */
export interface LayerStyle {
  font_family: string
  font_weight: number
  italic: boolean
  font_size: number
  line_height: number
  letter_spacing_pct: number
  color: string
}

interface Props {
  style: LayerStyle
  editable: boolean
  onChange: (patch: Partial<LayerStyle>) => void
}

export function LayerStyleControls({ style, editable, onChange }: Props) {
  const sizeOptions = FONT_SIZE_PX_OPTIONS.includes(
    Math.round(style.font_size) as never,
  )
    ? FONT_SIZE_PX_OPTIONS
    : [...FONT_SIZE_PX_OPTIONS, Math.round(style.font_size)].sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel>Font</FieldLabel>
        <Select
          value={style.font_family}
          disabled={!editable}
          onValueChange={(v) => onChange({ font_family: v })}
        >
          <SelectTrigger style={{ fontFamily: style.font_family }}>
            <SelectValue placeholder="Select a font" />
          </SelectTrigger>
          <SelectContent position="popper">
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel>Weight</FieldLabel>
          <NativeSelect
            value={style.font_weight}
            disabled={!editable}
            onChange={(e) => onChange({ font_weight: Number(e.target.value) })}
          >
            {FONT_WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label} ({w.value})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Style</FieldLabel>
          <button
            type="button"
            aria-pressed={style.italic}
            disabled={!editable}
            onClick={() => onChange({ italic: !style.italic })}
            className={cn(
              'h-9 w-full rounded-md border border-input bg-background text-sm italic transition-colors disabled:opacity-60',
              style.italic && 'bg-primary text-primary-foreground',
            )}
          >
            Italic
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Font size</FieldLabel>
        <NativeSelect
          value={Math.round(style.font_size)}
          disabled={!editable}
          onChange={(e) => onChange({ font_size: Number(e.target.value) })}
        >
          {sizeOptions.map((px) => (
            <option key={px} value={px}>
              {px} px
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Color</FieldLabel>
        <ColorInput
          value={style.color}
          onChange={(v) => onChange({ color: v })}
          presets={COLOR_PRESETS}
          disabled={!editable}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <FieldLabel>Line height</FieldLabel>
            <span className="text-xs text-muted-foreground">
              {style.line_height.toFixed(2)}
            </span>
          </div>
          <Slider
            min={0.8}
            max={3}
            step={0.05}
            value={style.line_height}
            disabled={!editable}
            onChange={(e) => onChange({ line_height: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <FieldLabel>Letter spacing</FieldLabel>
            <span className="text-xs text-muted-foreground">
              {(style.letter_spacing_pct * 100).toFixed(1)}%
            </span>
          </div>
          <Slider
            min={-2}
            max={10}
            step={0.1}
            value={style.letter_spacing_pct * 100}
            disabled={!editable}
            onChange={(e) =>
              onChange({ letter_spacing_pct: Number(e.target.value) / 100 })
            }
          />
        </div>
      </div>
    </div>
  )
}
