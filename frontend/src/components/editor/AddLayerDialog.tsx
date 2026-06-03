import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add text layer</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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
        </div>

        <DialogFooter>
          <Button
            disabled={!key.trim()}
            onClick={() => submit(key)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Add layer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
