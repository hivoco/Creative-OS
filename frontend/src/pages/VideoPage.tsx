import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardCheck, Clapperboard, History, Loader2 } from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { Badge } from '@/components/ui/badge'
import { ManagerReviewCard } from '@/components/video/ManagerReviewCard'
import { VideoComposer, type ComposeInput } from '@/components/video/VideoComposer'
import { VideoJobCard } from '@/components/video/VideoJobCard'
import {
  createVideoJob,
  deleteVideoJob,
  listVideoJobs,
  listVoices,
  submitVideoForReview,
} from '@/lib/videoServices'
import { useAuth } from '@/store/auth'

export function VideoPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  return (
    <div className="min-h-screen">
      <AppHeader />
      {isManager ? <ManagerReviewQueue /> : <EditorWorkspace />}
    </div>
  )
}

// ---- Editor: compose new videos + history --------------------------------

function EditorWorkspace() {
  const qc = useQueryClient()

  const voices = useQuery({ queryKey: ['voices'], queryFn: listVoices })
  const jobs = useQuery({
    queryKey: ['video-jobs'],
    queryFn: listVideoJobs,
    // Poll while any job is still running.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((j) => j.status === 'pending' || j.status === 'processing')
        ? 4000
        : false,
  })

  const generate = useMutation({
    mutationFn: (input: ComposeInput) =>
      createVideoJob({
        photo: input.photo,
        voiceId: input.voiceId,
        script: input.script,
        resolution: input.resolution,
      }),
    onSuccess: () => {
      toast.success('Video queued — generating…')
      qc.invalidateQueries({ queryKey: ['video-jobs'] })
    },
    onError: () => toast.error('Could not start the video'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteVideoJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video-jobs'] }),
  })

  const submit = useMutation({
    mutationFn: (id: string) => submitVideoForReview(id),
    onSuccess: () => {
      toast.success('Sent to your manager for review')
      qc.invalidateQueries({ queryKey: ['video-jobs'] })
    },
    onError: () => toast.error('Could not submit for review'),
  })

  const jobList = jobs.data ?? []
  const activeCount = jobList.filter(
    (j) => j.status === 'pending' || j.status === 'processing',
  ).length

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-4 lg:grid-cols-[380px_1fr]">
      {/* Composer — sticky on large screens */}
      <div className="lg:sticky lg:top-6">
        <VideoComposer
          voices={voices.data ?? []}
          generating={generate.isPending}
          onGenerate={(input) => generate.mutate(input)}
        />
      </div>

      {/* History gallery */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" /> History
          </h2>
          {!!jobList.length && (
            <Badge variant="secondary" className="tabular-nums">
              {jobList.length}
            </Badge>
          )}
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Loader2 className="size-3 animate-spin" /> {activeCount} generating
            </span>
          )}
        </div>

        {jobs.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video w-full animate-pulse rounded-xl border bg-muted"
              />
            ))}
          </div>
        ) : !jobList.length ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-16 text-center">
            <Clapperboard className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No videos yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first one with the panel on the left.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {jobList.map((job) => (
              <VideoJobCard
                key={job.id}
                job={job}
                onDelete={(id) => remove.mutate(id)}
                onSubmitReview={(id) => submit.mutate(id)}
                submitting={submit.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

// ---- Manager: review queue -----------------------------------------------

function ManagerReviewQueue() {
  const qc = useQueryClient()
  const jobs = useQuery({ queryKey: ['video-jobs'], queryFn: listVideoJobs })
  const refresh = () => qc.invalidateQueries({ queryKey: ['video-jobs'] })

  const jobList = jobs.data ?? []

  return (
    <main className="mx-auto max-w-7xl px-6 py-4">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4" /> Videos to review
        </h2>
        {!!jobList.length && (
          <Badge variant="secondary" className="tabular-nums">
            {jobList.length}
          </Badge>
        )}
      </div>

      {jobs.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-video w-full animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      ) : !jobList.length ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-16 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nothing to review</p>
          <p className="text-sm text-muted-foreground">
            Videos editors submit for review will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jobList.map((job) => (
            <ManagerReviewCard key={job.id} job={job} onReviewed={refresh} />
          ))}
        </div>
      )}
    </main>
  )
}
