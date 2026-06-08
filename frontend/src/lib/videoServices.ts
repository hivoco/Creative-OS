import { api } from '@/lib/api'
import type {
  BrandVoice,
  VideoComment,
  VideoJob,
  VideoReviewRequest,
} from '@/types'

export async function listVoices(): Promise<BrandVoice[]> {
  const { data } = await api.get<BrandVoice[]>('/video/voices')
  return data
}

export async function cloneVoice(input: {
  file: File
  title: string
  description: string
}): Promise<BrandVoice> {
  const form = new FormData()
  form.append('voice_file', input.file)
  form.append('title', input.title)
  form.append('description', input.description)
  const { data } = await api.post<BrandVoice>('/video/voices/clone', form)
  return data
}

export async function listVideoJobs(): Promise<VideoJob[]> {
  const { data } = await api.get<VideoJob[]>('/video/jobs')
  return data
}

export async function createVideoJob(input: {
  photo: File
  voiceId: string
  script: string
  resolution: '480p' | '720p'
}): Promise<VideoJob> {
  const form = new FormData()
  form.append('photo', input.photo)
  form.append('voice_id', input.voiceId)
  form.append('script', input.script)
  form.append('resolution', input.resolution)
  const { data } = await api.post<VideoJob>('/video/jobs', form)
  return data
}

export async function deleteVideoJob(id: string): Promise<void> {
  await api.delete(`/video/jobs/${id}`)
}

/**
 * Download a finished video to disk.
 *
 * The video lives on S3, so a plain `<a download>` is ignored (cross-origin)
 * and the file just opens in a tab. Instead we ask the backend for a
 * short-lived presigned URL whose response forces an `attachment` disposition,
 * then click an anchor pointed at it — the browser saves the MP4.
 */
export async function downloadVideoJob(id: string): Promise<void> {
  const { data } = await api.get<{ url: string }>(`/video/jobs/${id}/download`)
  const a = document.createElement('a')
  a.href = data.url
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ---- Review workflow ------------------------------------------------------

export async function getVideoReview(
  jobId: string,
): Promise<VideoReviewRequest | null> {
  const { data } = await api.get<VideoReviewRequest | null>(
    `/video/jobs/${jobId}/review`,
  )
  return data
}

export async function submitVideoForReview(
  jobId: string,
  reviewerId?: string,
): Promise<VideoReviewRequest> {
  const { data } = await api.post<VideoReviewRequest>(
    `/video/jobs/${jobId}/submit`,
    { reviewer_id: reviewerId ?? null },
  )
  return data
}

export async function approveVideo(jobId: string): Promise<VideoReviewRequest> {
  const { data } = await api.post<VideoReviewRequest>(`/video/jobs/${jobId}/approve`)
  return data
}

export async function rejectVideo(
  jobId: string,
  comment: string,
): Promise<VideoReviewRequest> {
  const { data } = await api.post<VideoReviewRequest>(`/video/jobs/${jobId}/reject`, {
    comment,
  })
  return data
}

export async function listVideoComments(jobId: string): Promise<VideoComment[]> {
  const { data } = await api.get<VideoComment[]>(`/video/jobs/${jobId}/comments`)
  return data
}

export async function addVideoComment(
  jobId: string,
  comment: string,
): Promise<VideoComment> {
  const { data } = await api.post<VideoComment>(`/video/jobs/${jobId}/comments`, {
    comment,
  })
  return data
}

export async function resolveVideoComment(
  commentId: string,
  resolved: 'open' | 'resolved',
): Promise<VideoComment> {
  const { data } = await api.patch<VideoComment>(`/video/comments/${commentId}`, {
    resolved,
  })
  return data
}

/** Format a UTC ISO timestamp as IST date-time. */
export function istDateTime(iso: string): string {
  if (!iso) return ''
  return (
    new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  )
}
