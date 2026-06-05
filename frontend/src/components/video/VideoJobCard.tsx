import { useState } from 'react'
import { toast } from 'sonner'
import { Clapperboard, Download, Loader2, Play, TriangleAlert, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmPopover } from '@/components/ui/confirm-popover'
import { VideoStages } from '@/components/video/VideoStages'
import { downloadVideoJob, istDateTime } from '@/lib/videoServices'
import { cn } from '@/lib/utils'
import type { VideoJob } from '@/types'

const STATUS_CHIP: Record<VideoJob['status'], { label: string; tone: string; dot: string }> = {
  completed: { label: 'Ready', tone: 'text-lime-400', dot: 'bg-lime-400' },
  processing: { label: 'Generating', tone: 'text-amber-400', dot: 'bg-amber-400' },
  pending: { label: 'Queued', tone: 'text-white/60', dot: 'bg-white/60' },
  failed: { label: 'Failed', tone: 'text-red-400', dot: 'bg-red-400' },
}

export function VideoJobCard({
  job,
  onDelete,
}: {
  job: VideoJob
  onDelete: (id: string) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const chip = STATUS_CHIP[job.status]
  const still = job.image_url ?? job.photo_url ?? undefined
  const done = job.status === 'completed' && !!job.video_url
  const inFlight = job.status === 'processing' || job.status === 'pending'

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadVideoJob(job.id)
    } catch {
      toast.error('Could not download the video')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="group relative gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-sm transition hover:shadow-xl">
      {/* Delete — floats top-right, like the template cards */}
      <div className="absolute right-3 top-3 z-30">
        <ConfirmPopover
          trigger={
            <Button
              variant="secondary"
              size="icon-sm"
              className="opacity-0 shadow-sm transition group-hover:opacity-100"
              aria-label="Delete video"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          }
          title="Delete this video?"
          description="Removes it from your history. This can't be undone."
          onConfirm={() => onDelete(job.id)}
        />
      </div>

      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {done && playing ? (
          <video
            src={job.video_url!}
            poster={still}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 z-20 h-full w-full bg-black object-contain"
          />
        ) : (
          <>
            {/* Still image fills the card; the video only loads on click */}
            {still ? (
              <img
                src={still}
                alt={job.title}
                loading="lazy"
                className={cn(
                  'absolute inset-0 h-full w-full object-contain',
                  !done && 'brightness-[0.92]',
                )}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Play className="size-8" />
              </div>
            )}

            {/* Completed → tap the play button to load + play */}
            {done && (
              <div className="absolute inset-x-0 top-[30%] z-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label="Play video"
                  className="flex size-14 items-center justify-center rounded-full bg-background/85 text-foreground shadow-lg ring-1 ring-border transition-transform hover:scale-110"
                >
                  <Play className="ml-0.5 size-6 fill-current" />
                </button>
              </div>
            )}

            {/* In progress → quiet spinner above the panel */}
            {inFlight && (
              <div className="absolute inset-x-0 top-[28%] z-10 flex justify-center text-foreground/70">
                <Loader2 className="size-7 animate-spin" />
              </div>
            )}

            {/* Failed → alert above the panel */}
            {job.status === 'failed' && (
              <div className="absolute inset-x-0 top-[26%] z-10 flex justify-center text-destructive">
                <TriangleAlert className="size-7" />
              </div>
            )}

            {/* Floating info panel — inset & fully rounded, like the template cards */}
            <div className="absolute inset-x-3 bottom-3 z-20 space-y-2 rounded-2xl bg-neutral-950/95 px-5 py-4 text-white shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]',
                    chip.tone,
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', chip.dot)} />
                  {chip.label}
                </span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                  {job.resolution}
                </span>
              </div>

              <p className="truncate text-2xl font-extrabold leading-tight" title={job.title}>
                {job.title}
              </p>
              <p className="flex items-center gap-1 truncate text-[11px] text-white/40">
                <Clapperboard className="h-3 w-3 shrink-0" />
                {istDateTime(job.created_at)}
                {job.voice_name ? ` · ${job.voice_name}` : ''}
              </p>

              {inFlight && (
                <div className="pt-1.5">
                  <VideoStages job={job} />
                </div>
              )}

              {job.status === 'failed' && job.error && (
                <p className="rounded-md border border-red-400/30 bg-red-400/10 p-2 text-xs text-red-300">
                  {job.error}
                </p>
              )}

              {done && (
                <Button
                  size="sm"
                  className="mt-1 w-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  {downloading ? 'Preparing…' : 'Download MP4'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
