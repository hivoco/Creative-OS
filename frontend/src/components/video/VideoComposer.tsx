import { useState } from 'react'
import { Clapperboard, ImagePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CloneVoiceDialog } from '@/components/video/CloneVoiceDialog'
import type { BrandVoice } from '@/types'

export interface ComposeInput {
  photo: File
  voiceId: string
  script: string
  resolution: '480p' | '720p'
}

interface Props {
  voices: BrandVoice[]
  generating: boolean
  onGenerate: (input: ComposeInput) => void
}

export function VideoComposer({ voices, generating, onGenerate }: Props) {
  const [voiceId, setVoiceId] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [script, setScript] = useState('')
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p')

  function pickPhoto(f: File | null) {
    setPhoto(f)
    setPhotoUrl(f ? URL.createObjectURL(f) : null)
  }

  const ready = !!photo && !!voiceId && !!script.trim()

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Create a video</h2>

      {/* Voice */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Voice</Label>
          <CloneVoiceDialog onCloned={setVoiceId} />
        </div>
        <Select value={voiceId} onValueChange={setVoiceId}>
          <SelectTrigger>
            <SelectValue placeholder={voices.length ? 'Select a voice' : 'No voices yet — clone one'} />
          </SelectTrigger>
          <SelectContent>
            {voices.map((v) => (
              <SelectItem key={v.id} value={v.voice_id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Photo */}
      <div className="space-y-1.5">
        <Label htmlFor="vid-photo">Photo</Label>
        <label
          htmlFor="vid-photo"
          className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 text-sm hover:bg-muted"
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="size-12 rounded object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded bg-muted">
              <ImagePlus className="size-5 text-muted-foreground" />
            </span>
          )}
          <span className="truncate text-muted-foreground">
            {photo ? photo.name : 'Upload a clear face photo'}
          </span>
          <input
            id="vid-photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Script */}
      <div className="space-y-1.5">
        <Label htmlFor="vid-script">Script</Label>
        <textarea
          id="vid-script"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="What should they say?"
          className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      {/* Resolution */}
      <div className="space-y-1.5">
        <Label>Resolution</Label>
        <Select value={resolution} onValueChange={(v) => setResolution(v as '480p' | '720p')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="480p">480p (faster)</SelectItem>
            <SelectItem value="720p">720p (HD)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full"
        disabled={!ready || generating}
        onClick={() => photo && onGenerate({ photo, voiceId, script: script.trim(), resolution })}
      >
        <Clapperboard className="mr-1 h-4 w-4" />
        {generating ? 'Starting…' : 'Generate video'}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Generation runs in the background (≈1–3 min). You can leave this page; it
        appears in History when done.
      </p>
    </div>
  )
}
