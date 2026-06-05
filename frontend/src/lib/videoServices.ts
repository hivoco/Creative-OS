import { api } from '@/lib/api'
import type { BrandVoice, VideoJob } from '@/types'

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
