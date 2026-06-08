import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Crop, Download, ImageOff, Loader2, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ConfirmPopover } from '@/components/ui/confirm-popover'
import {
  createRatioVariantFromComposite,
  deleteRatioVariant,
  getBlankImageBlob,
  listRatioVariants,
} from '@/lib/services'
import { renderVersionWithBlank } from '@/lib/canvasRenderer'
import { langLabel } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TextLayer } from '@/types'

const PRESETS: { ratio: string; name: string; w: number; h: number }[] = [
  { ratio: '1:1', name: 'Square', w: 1080, h: 1080 },
  { ratio: '4:5', name: 'Portrait', w: 1080, h: 1350 },
  { ratio: '9:16', name: 'Story', w: 1080, h: 1920 },
  { ratio: '16:9', name: 'Landscape', w: 1920, h: 1080 },
  { ratio: '4:3', name: 'Standard', w: 1440, h: 1080 },
  { ratio: '3:4', name: 'Tall', w: 1080, h: 1440 },
]

interface Props {
  versionId: string
  blankImageUrl: string
  baseLayers: TextLayer[]
  language: string
  sourceLanguage?: string
  // Source design dimensions — the composite is rendered at these, then extended.
  sourceWidth?: number
  sourceHeight?: number
  editable: boolean
}

export function RatioDialog({
  versionId,
  baseLayers,
  language,
  sourceLanguage,
  sourceWidth,
  sourceHeight,
  editable,
}: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newRatio, setNewRatio] = useState('9:16')

  // Confirm-before-resize popover, with a live render of the current design so
  // the user can see exactly what they're about to adapt.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [preview, setPreview] = useState<{ url: string | null; loading: boolean }>({
    url: null,
    loading: false,
  })

  // Revoke the blob URL on unmount so we don't leak it.
  useEffect(() => {
    return () => {
      if (preview.url) URL.revokeObjectURL(preview.url)
    }
  }, [preview.url])

  async function openConfirm(next: boolean) {
    setConfirmOpen(next)
    if (!next) {
      if (preview.url) URL.revokeObjectURL(preview.url)
      setPreview({ url: null, loading: false })
      return
    }
    setPreview({ url: null, loading: true })
    try {
      const blob = await renderComposite()
      setPreview({ url: URL.createObjectURL(blob), loading: false })
    } catch {
      setPreview({ url: null, loading: false })
    }
  }

  // Render the current design to a composite bitmap in the browser — identical
  // to what the canvas shows (wrapped text included). Used for both the preview
  // and the actual resize, so the resize input is never the clipped server render.
  async function renderComposite(): Promise<Blob> {
    if (!sourceWidth || !sourceHeight) throw new Error('Design not ready')
    const blank = await getBlankImageBlob(versionId)
    return renderVersionWithBlank(blank, {
      width: sourceWidth,
      height: sourceHeight,
      layers: baseLayers,
      language,
      sourceLanguage,
      format: 'png',
    })
  }

  const variants = useQuery({
    queryKey: ['ratios', versionId],
    queryFn: () => listRatioVariants(versionId),
    enabled: open,
  })
  const selected =
    variants.data?.find((v) => v.id === selectedId) ?? variants.data?.[0] ?? null

  const create = useMutation({
    mutationFn: async () => {
      const p = PRESETS.find((x) => x.ratio === newRatio)!
      const composite = await renderComposite()
      return createRatioVariantFromComposite(versionId, newRatio, { w: p.w, h: p.h }, composite)
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Crop className="mr-1 h-4 w-4" /> Resize
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-4 overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Resize to another ratio</SheetTitle>
          <SheetDescription>
            Adapt this design to other aspect ratios for different placements.
          </SheetDescription>
        </SheetHeader>

        {editable && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 fill-amber-400 text-amber-500" />
                <h3 className="text-sm font-semibold">Aspect ratio</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                AI reframes · no stretching
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {PRESETS.map((p) => {
                const active = p.ratio === newRatio
                const scale = 16 / Math.max(p.w, p.h)
                return (
                  <button
                    key={p.ratio}
                    type="button"
                    onClick={() => setNewRatio(p.ratio)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md border bg-background px-1 py-1.5 transition-colors',
                      active
                        ? 'border-foreground ring-1 ring-foreground'
                        : 'border-border hover:border-foreground/40 hover:bg-muted/60',
                    )}
                  >
                    <span className="flex h-5 items-center justify-center">
                      <span
                        className={cn(
                          'rounded-[2px] border-2',
                          active
                            ? 'border-foreground bg-foreground/70'
                            : 'border-muted-foreground/50',
                        )}
                        style={{ width: p.w * scale, height: p.h * scale }}
                      />
                    </span>
                    <span className="text-xs font-semibold leading-none">{p.ratio}</span>
                    <span className="text-[10px] leading-none text-muted-foreground">
                      {p.name}
                    </span>
                  </button>
                )
              })}
            </div>

            <Popover open={confirmOpen} onOpenChange={openConfirm}>
              <PopoverTrigger asChild>
                <Button className="w-full" disabled={create.isPending}>
                  {create.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4 fill-amber-400 text-amber-400" />
                  )}
                  Generate {newRatio} · {langLabel(language)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={8} className="w-72 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Resize to {newRatio}?</p>
                  <p className="text-xs text-muted-foreground">
                    Sends the {langLabel(language)} design below to AI, which
                    re-composes it to fill {newRatio} — your subject, text and
                    logo are rearranged to fit the new frame, nothing is
                    stretched or blurred.
                  </p>
                </div>
                <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                  {preview.loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : preview.url ? (
                    <img
                      src={preview.url}
                      alt="Current design"
                      className="max-h-44 w-full object-contain"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1 p-4 text-center text-xs text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                      Preview unavailable
                    </span>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={create.isPending}
                    onClick={() => {
                      create.mutate()
                      openConfirm(false)
                    }}
                  >
                    Resize
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="grid grid-cols-[96px_1fr] gap-3">
          {/* List */}
          <div className="space-y-1">
            {variants.data?.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={
                  'flex w-full items-center gap-2 rounded-md border p-1 text-left ' +
                  (v.id === selected?.id
                    ? 'border-foreground/30 bg-accent/60'
                    : 'border-border hover:bg-muted')
                }
              >
                {v.blank_image_url && (
                  <img
                    src={v.blank_image_url}
                    alt={v.ratio}
                    className="h-10 w-8 shrink-0 rounded border border-border object-cover"
                  />
                )}
                <p className="min-w-0 truncate text-xs font-medium">{v.ratio}</p>
              </button>
            ))}
            {!variants.data?.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">
                No resizes yet. Pick a ratio above.
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="relative flex max-h-[78vh] min-h-[64vh] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-3">
            {selected?.blank_image_url ? (
              <>
                <img
                  src={selected.blank_image_url}
                  alt={selected.ratio}
                  className="max-h-[72vh] rounded-md border border-border bg-background object-contain"
                />
                {/* Actions float over the image, top-right */}
                <div className="absolute right-4 top-4 flex gap-2">
                  <a href={selected.blank_image_url} download target="_blank" rel="noreferrer">
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      aria-label="Download"
                      className="bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  {editable && (
                    <ConfirmPopover
                      title={`Delete ${selected.ratio} resize?`}
                      description="This permanently removes this ratio variant. This cannot be undone."
                      onConfirm={() => remove.mutate(selected.id)}
                      trigger={
                        <Button
                          size="icon-sm"
                          variant="secondary"
                          aria-label="Delete this resize"
                          className="bg-background/85 text-destructive shadow-sm backdrop-blur-sm hover:bg-background hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
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
      </SheetContent>
    </Sheet>
  )
}
