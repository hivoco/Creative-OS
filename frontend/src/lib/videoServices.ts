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
