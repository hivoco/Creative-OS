import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { History } from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { VideoComposer, type ComposeInput } from '@/components/video/VideoComposer'
import { VideoJobCard } from '@/components/video/VideoJobCard'
import {
  createVideoJob,
  deleteVideoJob,
  listVideoJobs,
  listVoices,
} from '@/lib/videoServices'
import { useAuth } from '@/store/auth'

export function VideoPage() {
  const qc = useQueryClient()
  const { user } = useAuth()

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

  // Video AI is editor-only.
  if (user && user.role !== 'editor') return <Navigate to="/" replace />

  const jobList = jobs.data ?? []

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[400px_1fr]">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Video AI</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Photo + script + voice → lip-synced talking-head video.
          </p>
          <VideoComposer
            voices={voices.data ?? []}
            generating={generate.isPending}
            onGenerate={(input) => generate.mutate(input)}
          />
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" /> History
          </h2>
          {jobs.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !jobList.length ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No videos yet. Create your first one on the left.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {jobList.map((job) => (
                <VideoJobCard key={job.id} job={job} onDelete={(id) => remove.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
