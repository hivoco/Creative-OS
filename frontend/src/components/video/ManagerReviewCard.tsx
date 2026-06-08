import { useState } from 'react'
import { ChevronDown, ChevronUp, Clapperboard, Play } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { VideoReviewPanel } from '@/components/video/VideoReviewPanel'
import { istDateTime } from '@/lib/videoServices'
import type { VideoJob } from '@/types'

/**
 * A compact item in the manager's review queue: a small click-to-play
 * preview, with the approve / reject / comment panel tucked behind a toggle
 * so several videos stay visible at once.
 */
export function ManagerReviewCard({
  job,
  onReviewed,
}: {
  job: VideoJob
  onReviewed: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const still = job.image_url ?? job.photo_url ?? undefined

  return (
    <Card className="flex flex-col gap-0 overflow-hidden rounded-xl p-0">
      <div className="relative aspect-video w-full bg-black">
        {playing && job.video_url ? (
          <video
            src={job.video_url}
            poster={still}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        ) : (
          <>
            {still ? (
              <img
                src={still}
                alt={job.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">
                <Play className="size-7" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-background/85 text-foreground shadow ring-1 ring-border transition hover:scale-110">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={job.title}>
            {job.title}
          </p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Clapperboard className="h-3 w-3 shrink-0" />
            {istDateTime(job.created_at)}
            {job.voice_name ? ` · ${job.voice_name}` : ''} · {job.resolution}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Review
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border p-3">
          <VideoReviewPanel
            jobId={job.id}
            status={job.review_status}
            role="manager"
            onStatusChange={onReviewed}
          />
        </div>
      )}
    </Card>
  )
}
