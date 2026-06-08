import { useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Send,
  TriangleAlert,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmPopover } from '@/components/ui/confirm-popover'
import { VideoReviewPanel } from '@/components/video/VideoReviewPanel'
import { VideoStages } from '@/components/video/VideoStages'
import { downloadVideoJob } from '@/lib/videoServices'
import { cn } from '@/lib/utils'
import type { VideoJob, VideoReviewStatus } from '@/types'

const STATUS_CHIP: Record<VideoJob['status'], { label: string; tone: string; dot: string }> = {
  completed: { label: 'Ready', tone: 'text-lime-400', dot: 'bg-lime-400' },
  processing: { label: 'Generating', tone: 'text-amber-400', dot: 'bg-amber-400' },
  pending: { label: 'Queued', tone: 'text-white/60', dot: 'bg-white/60' },
  failed: { label: 'Failed', tone: 'text-red-400', dot: 'bg-red-400' },
}

const REVIEW_CHIP: Record<VideoReviewStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-secondary text-secondary-foreground' },
  in_review: { label: 'In review', cls: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Approved', cls: 'bg-lime-100 text-lime-900' },
  rejected: { label: 'Changes requested', cls: 'bg-destructive/15 text-destructive' },
}

export function VideoJobCard({
  job,
  onDelete,
  onSubmitReview,
  submitting = false,
}: {
  job: VideoJob
  onDelete: (id: string) => void
  onSubmitReview?: (id: string) => void
  submitting?: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const chip = STATUS_CHIP[job.status]
  const reviewChip = REVIEW_CHIP[job.review_status]
  const still = job.image_url ?? job.photo_url ?? undefined
  const done = job.status === 'completed' && !!job.video_url
  const inFlight = job.status === 'processing' || job.status === 'pending'
  const approved = job.review_status === 'approved'
  const canSubmit =
    done && (job.review_status === 'draft' || job.review_status === 'rejected')
  const hasReview = job.review_status !== 'draft'

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
              <div className="absolute inset-0 z-10 flex items-center justify-center">
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
              <div className="absolute inset-x-0 top-[26%] z-10 flex justify-center text-foreground/70">
                <Loader2 className="size-7 animate-spin" />
              </div>
            )}

            {/* Failed → alert above the panel */}
            {job.status === 'failed' && (
              <div className="absolute inset-x-0 top-[24%] z-10 flex justify-center text-destructive">
                <TriangleAlert className="size-7" />
              </div>
            )}

            {/* Compact caption — status + title only, so the thumbnail stays visible */}
            <div className="absolute inset-x-0 bottom-0 z-20 space-y-0.5 bg-linear-to-t from-neutral-950/95 via-neutral-950/60 to-transparent px-3 pb-2 pt-6 text-white">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]',
                    chip.tone,
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
                  {chip.label}
                </span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
                  {job.resolution}
                </span>
              </div>

              <p className="truncate text-sm font-bold leading-tight" title={job.title}>
                {job.title}
              </p>

              {inFlight && (
                <div className="pt-1">
                  <VideoStages job={job} />
                </div>
              )}

              {job.status === 'failed' && job.error && (
                <p className="mt-1 rounded-md border border-red-400/30 bg-red-400/10 p-1.5 text-xs text-red-300">
                  {job.error}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Review footer — sits below the thumbnail so the image stays clear */}
      {done && (
        <div className="space-y-2 border-t border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                reviewChip.cls,
              )}
            >
              {reviewChip.label}
            </span>
            {hasReview && (
              <button
                type="button"
                onClick={() => setShowFeedback((s) => !s)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="h-3 w-3" />
                {showFeedback ? 'Hide feedback' : 'View feedback'}
              </button>
            )}
          </div>

          {canSubmit && onSubmitReview && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onSubmitReview(job.id)}
              disabled={submitting}
            >
              <Send className="mr-1 h-4 w-4" />
              {job.review_status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            </Button>
          )}

          {approved && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
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

          {job.review_status === 'in_review' && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Download unlocks after approval
            </p>
          )}

          {showFeedback && hasReview && (
            <div className="pt-1">
              <VideoReviewPanel
                jobId={job.id}
                status={job.review_status}
                role="editor"
                onStatusChange={() => {}}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
