import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createTemplate } from '@/lib/services'

export function UploadTemplateDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('campaign')
  const [file, setFile] = useState<File | null>(null)
  const [width, setWidth] = useState(1080)
  const [height, setHeight] = useState(1080)

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Pick an image')
      return createTemplate({ name, category, width, height, file })
    },
    onSuccess: () => {
      toast.success('Template uploaded')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      setOpen(false)
      setName('')
      setFile(null)
    },
    onError: () => toast.error('Upload failed'),
  })

  function onFile(f: File | null) {
    setFile(f)
    if (!f) return
    const img = new Image()
    img.onload = () => {
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
    }
    img.src = URL.createObjectURL(f)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">
          <Upload className="mr-1.5 h-4 w-4" />
          Upload template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload blank template</DialogTitle>
          <DialogDescription>
            Upload a PNG/JPG with no text baked in. Text is composited at render
            time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Sale Poster"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-cat">Category</Label>
            <Input
              id="t-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="campaign"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-file">Blank image</Label>
            <Input
              id="t-file"
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {file && (
            <p className="text-xs text-muted-foreground">
              Detected dimensions: {width} × {height} px
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={!name || !file || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Uploading…' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
