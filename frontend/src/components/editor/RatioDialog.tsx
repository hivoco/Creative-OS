import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Crop, Download, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/Field'
import {
  createRatioVariant,
  deleteRatioVariant,
  listRatioVariants,
} from '@/lib/services'
import { langLabel } from '@/lib/constants'
import type { TextLayer } from '@/types'

const PRESETS: { ratio: string; w: number; h: number }[] = [
  { ratio: '1:1', w: 1080, h: 1080 },
  { ratio: '9:16', w: 1080, h: 1920 },
  { ratio: '16:9', w: 1920, h: 1080 },
  { ratio: '4:5', w: 1080, h: 1350 },
  { ratio: '3:4', w: 1080, h: 1440 },
  { ratio: '4:3', w: 1440, h: 1080 },
]

interface Props {
  versionId: string
  blankImageUrl: string
  baseLayers: TextLayer[]
  language: string
  editable: boolean
}

export function RatioDialog({ versionId, language, editable }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newRatio, setNewRatio] = useState(PRESETS[1].ratio)

  const variants = useQuery({
    queryKey: ['ratios', versionId],
    queryFn: () => listRatioVariants(versionId),
    enabled: open,
  })
  const selected =
    variants.data?.find((v) => v.id === selectedId) ?? variants.data?.[0] ?? null

  const create = useMutation({
    mutationFn: () => {
      const p = PRESETS.find((x) => x.ratio === newRatio)!
      return createRatioVariant(versionId, newRatio, { w: p.w, h: p.h }, language)
    },
    onSuccess: (v) => {
      toast.success(`Resized to ${v.ratio}`)
      qc.invalidateQueries({ queryKey: ['ratios', versionId] })
      setSelectedId(v.id)
    },
    onError: () => toast.error('Could not resize'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteRatioVariant(id),
    onSuccess: () => {
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['ratios', versionId] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Crop className="mr-1 h-4 w-4" /> Resize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Resize to another ratio</DialogTitle>
        </DialogHeader>

        {editable && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
            <NativeSelect
              value={newRatio}
              onChange={(e) => setNewRatio(e.target.value)}
              className="h-9"
            >
              {PRESETS.map((p) => (
                <option key={p.ratio} value={p.ratio}>
                  {p.ratio}
                </option>
              ))}
            </NativeSelect>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Resize ({langLabel(language)})
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Extends the current design — text stays put, no stretching.
            </p>
          </div>
        )}

        <div className="grid grid-cols-[160px_1fr] gap-4">
          {/* List */}
          <div className="space-y-1">
            {variants.data?.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={
                  'flex w-full items-center gap-2 rounded-md border p-1.5 text-left ' +
                  (v.id === selected?.id
                    ? 'border-foreground/30 bg-accent/60'
                    : 'border-border hover:bg-muted')
                }
              >
                {v.blank_image_url && (
                  <img
                    src={v.blank_image_url}
                    alt={v.ratio}
                    className="h-12 w-9 shrink-0 rounded border border-border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.ratio}</p>
                </div>
              </button>
            ))}
            {!variants.data?.length && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No resizes yet. Pick a ratio above.
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="flex max-h-[60vh] flex-col items-center justify-center gap-3 overflow-auto rounded-md border border-border bg-muted/30 p-3">
            {selected?.blank_image_url ? (
              <>
                <img
                  src={selected.blank_image_url}
                  alt={selected.ratio}
                  className="max-h-[48vh] rounded-md border border-border bg-background object-contain"
                />
                <div className="flex gap-2">
                  <a href={selected.blank_image_url} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      <Download className="mr-1 h-4 w-4" /> Download
                    </Button>
                  </a>
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove.mutate(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select or create a resize to preview it.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
