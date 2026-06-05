import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Mic, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cloneVoice } from '@/lib/videoServices'

/**
 * Clone a voice from a short audio sample. Presented as a contextual popover
 * anchored to its trigger (rather than a page-blocking centered modal), so the
 * voice picker stays visible while you add a new one.
 */
export function CloneVoiceDialog({ onCloned }: { onCloned?: (voiceId: string) => void }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('pick a sample')
      return cloneVoice({ file, title, description })
    },
    onSuccess: (v) => {
      toast.success('Voice cloned')
      qc.invalidateQueries({ queryKey: ['voices'] })
      onCloned?.(v.voice_id)
      setOpen(false)
      setTitle('')
      setDescription('')
      setFile(null)
    },
    onError: () => toast.error('Voice clone failed'),
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" /> Clone voice
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 space-y-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Mic className="h-4 w-4" /> Clone a voice
          </p>
          <p className="text-xs text-muted-foreground">
            Upload a short, clean sample (10–30s) of the voice to clone.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v-title">Voice name</Label>
          <Input
            id="v-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Brand Narrator"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-desc">Description (optional)</Label>
          <Input
            id="v-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="v-file">Audio sample</Label>
          <Input
            id="v-file"
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!title || !file || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Cloning…
            </>
          ) : (
            'Clone voice'
          )}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
