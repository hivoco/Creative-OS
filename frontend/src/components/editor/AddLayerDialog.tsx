import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PRESET_LAYER_KEYS } from '@/lib/constants'

export function AddLayerDialog({ onAdd }: { onAdd: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')

  function submit(value: string) {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setKey('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 space-y-3">
        <p className="text-sm font-semibold">Add text layer</p>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">
            Quick presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_LAYER_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => submit(k)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="layer-key">Custom key</Label>
          <Input
            id="layer-key"
            value={key}
            placeholder="e.g. offer_badge"
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(key)}
          />
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!key.trim()}
            onClick={() => submit(key)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Add layer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
