import { Check, Download, Loader2, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { istDateTime } from '@/lib/videoServices'
import type { VideoJob, VideoStageStatus } from '@/types'

const STATUS_VARIANT: Record<string, string> = {
  completed: 'bg-accent text-accent-foreground',
  processing: 'bg-amber-100 text-amber-900',
  pending: 'bg-secondary text-secondary-foreground',
  failed: 'bg-destructive/15 text-destructive',
}

function StageDot({ label, status }: { label: string; status: VideoStageStatus }) {
  const icon =
    status === 'completed' ? (
      <Check className="size-3 text-foreground" />
    ) : status === 'processing' ? (
      <Loader2 className="size-3 animate-spin text-amber-600" />
    ) : status === 'failed' ? (
      <X className="size-3 text-destructive" />
    ) : (
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
    )
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {icon}
      {label}
    </span>
  )
}

export function VideoJobCard({
  job,
  onDelete,
}: {
  job: VideoJob
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{job.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {istDateTime(job.created_at)} · {job.resolution} · {job.voice_name}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={`uppercase ${STATUS_VARIANT[job.status] ?? ''}`}
        >
          {job.status}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <StageDot label="Image" status={job.image_status} />
        <StageDot label="Audio" status={job.audio_status} />
        <StageDot label="Lipsync" status={job.lipsync_status} />
      </div>

      {job.status === 'completed' && job.video_url && (
        <div className="space-y-2">
          <video
            src={job.video_url}
            controls
            className="w-full rounded-md border border-border bg-black"
          />
          <a href={job.video_url} download target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="w-full">
              <Download className="mr-1 h-4 w-4" /> Download MP4
            </Button>
          </a>
        </div>
      )}

      {job.status === 'failed' && job.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {job.error}
        </p>
      )}

      <div className="flex justify-end">
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
          title="Delete this video?"
          description="Removes the job from your history. This cannot be undone."
          onConfirm={() => onDelete(job.id)}
        />
      </div>
    </div>
  )
}
