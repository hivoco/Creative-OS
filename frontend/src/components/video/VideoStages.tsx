import { AudioLines, Check, Clapperboard, ImageIcon, Loader2, X } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { VideoJob, VideoStageStatus } from '@/types'

const STAGES = [
  {
    key: 'image_status',
    label: 'Portrait',
    hint: 'Preparing the face',
    Icon: ImageIcon,
  },
  {
    key: 'audio_status',
    label: 'Voiceover',
    hint: 'Speaking the script',
    Icon: AudioLines,
  },
  {
    key: 'lipsync_status',
    label: 'Lip-sync',
    hint: 'Syncing mouth to audio',
    Icon: Clapperboard,
  },
] as const

/** 0–100 — completed stages count full, an in-flight stage counts half. */
export function stageProgress(job: VideoJob): number {
  const weight = (s: VideoStageStatus) =>
    s === 'completed' ? 1 : s === 'processing' ? 0.5 : 0
  const done =
    weight(job.image_status) + weight(job.audio_status) + weight(job.lipsync_status)
  return Math.round((done / STAGES.length) * 100)
}

function StepIcon({ status, Icon }: { status: VideoStageStatus; Icon: typeof ImageIcon }) {
  const base = 'flex size-9 items-center justify-center rounded-full border transition-colors'
  if (status === 'completed')
    return (
      <span className={cn(base, 'border-transparent bg-primary text-primary-foreground')}>
        <Check className="size-4" strokeWidth={3} />
      </span>
    )
  if (status === 'processing')
    return (
      <span className={cn(base, 'border-amber-400/60 bg-amber-400/15 text-amber-400')}>
        <Loader2 className="size-4 animate-spin" />
      </span>
    )
  if (status === 'failed')
    return (
      <span className={cn(base, 'border-red-400/50 bg-red-400/15 text-red-400')}>
        <X className="size-4" strokeWidth={3} />
      </span>
    )
  return (
    <span className={cn(base, 'border-dashed border-white/25 bg-white/5 text-white/50')}>
      <Icon className="size-4" />
    </span>
  )
}

function statusLabel(status: VideoStageStatus, hint: string) {
  if (status === 'completed') return 'Done'
  if (status === 'processing') return 'Working…'
  if (status === 'failed') return 'Failed'
  return hint
}

/**
 * A clear, three-step picture of where a video is in the pipeline:
 * Portrait → Voiceover → Lip-sync. Each step shows its own state so a glance
 * tells you exactly what is happening. Styled for a dark card surface.
 */
export function VideoStages({ job }: { job: VideoJob }) {
  const pct = job.status === 'completed' ? 100 : stageProgress(job)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-1.5 bg-white/15" />
        <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-white/60">
          {pct}%
        </span>
      </div>

      <ol className="flex items-start">
        {STAGES.map((stage, i) => {
          const status = job[stage.key] as VideoStageStatus
          return (
            <li key={stage.key} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                {/* left connector */}
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    i === 0
                      ? 'bg-transparent'
                      : (job[STAGES[i - 1].key] as VideoStageStatus) === 'completed'
                        ? 'bg-primary'
                        : 'bg-white/15',
                  )}
                />
                <StepIcon status={status} Icon={stage.Icon} />
                {/* right connector */}
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    i === STAGES.length - 1
                      ? 'bg-transparent'
                      : status === 'completed'
                        ? 'bg-primary'
                        : 'bg-white/15',
                  )}
                />
              </div>
              <span className="mt-1.5 text-xs font-medium text-white">{stage.label}</span>
              <span
                className={cn(
                  'text-[11px]',
                  status === 'processing'
                    ? 'text-amber-400'
                    : status === 'failed'
                      ? 'text-red-400'
                      : 'text-white/50',
                )}
              >
                {statusLabel(status, stage.hint)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
