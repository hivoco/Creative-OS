import { useState } from 'react'
import { Clapperboard, ImagePlus, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
    <Card className="gap-0 py-0">
      <CardHeader className="gap-1 border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Generate New video
        </CardTitle>
        <CardDescription>Photo + script + voice → a lip-synced talking head.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 py-5">
        {/* Step 1 — Voice */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>
              <span className="mr-1.5 text-muted-foreground">1.</span> Voice
            </Label>
            <CloneVoiceDialog onCloned={setVoiceId} />
          </div>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={voices.length ? 'Select a voice' : 'No voices yet — clone one'}
              />
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

        <Separator />

        {/* Step 2 — Photo */}
        <div className="space-y-1.5">
          <Label htmlFor="vid-photo">
            <span className="mr-1.5 text-muted-foreground">2.</span> Photo
          </Label>
          <label
            htmlFor="vid-photo"
            className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 text-sm transition-colors hover:bg-muted"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="size-12 rounded object-cover" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded bg-muted">
                <ImagePlus className="size-5 text-muted-foreground" />
              </span>
            )}
            <span className="truncate text-muted-foreground">
              {photo ? photo.name : 'Upload a clear, front-facing photo'}
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

        <Separator />

        {/* Step 3 — Script */}
        <div className="space-y-1.5">
          <Label htmlFor="vid-script">
            <span className="mr-1.5 text-muted-foreground">3.</span> Script
          </Label>
          <textarea
            id="vid-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="What should they say?"
            className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <p className="text-right text-[11px] text-muted-foreground">{script.length} chars</p>
        </div>

        <Separator />

        {/* Step 4 — Resolution */}
        <div className="space-y-1.5">
          <Label>
            <span className="mr-1.5 text-muted-foreground">4.</span> Resolution
          </Label>
          <ToggleGroup
            type="single"
            value={resolution}
            onValueChange={(v) => v && setResolution(v as '480p' | '720p')}
            className="w-full justify-between"
          >
            <ToggleGroupItem value="480p" className="flex-1">
              480p · faster
            </ToggleGroupItem>
            <ToggleGroupItem value="720p" className="flex-1">
              720p · HD
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Button
          className="w-full"
          disabled={!ready || generating}
          onClick={() =>
            photo && onGenerate({ photo, voiceId, script: script.trim(), resolution })
          }
        >
          <Clapperboard className="mr-1 h-4 w-4" />
          {generating ? 'Starting…' : 'Generate video'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Generation runs in the background (≈1–3 min). You can leave this page — it shows up in
          History when it's done.
        </p>
      </CardContent>
    </Card>
  )
}
