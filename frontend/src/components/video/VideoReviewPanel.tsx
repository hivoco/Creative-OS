import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldLabel } from '@/components/ui/Field'
import {
  addVideoComment,
  approveVideo,
  getVideoReview,
  listVideoComments,
  rejectVideo,
  resolveVideoComment,
} from '@/lib/videoServices'
import type { VideoReviewStatus } from '@/types'

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

interface Props {
  jobId: string
  status: VideoReviewStatus
  role: 'editor' | 'manager'
  onStatusChange: () => void
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  in_review: 'bg-amber-100 text-amber-900',
  approved: 'bg-accent text-accent-foreground',
  rejected: 'bg-destructive/15 text-destructive',
}

export function VideoReviewPanel({ jobId, status, role, onStatusChange }: Props) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const comments = useQuery({
    queryKey: ['video-comments', jobId],
    queryFn: () => listVideoComments(jobId),
    enabled: !!jobId,
  })
  const review = useQuery({
    queryKey: ['video-review', jobId],
    queryFn: () => getVideoReview(jobId),
    enabled: !!jobId,
  })

  const refresh = () => {
    onStatusChange()
    qc.invalidateQueries({ queryKey: ['video-comments', jobId] })
    qc.invalidateQueries({ queryKey: ['video-review', jobId] })
  }

  const rejectWords = wordCount(rejectReason)
  const rejectValid = rejectWords >= 1 && rejectWords <= 100

  const approve = useMutation({
    mutationFn: () => approveVideo(jobId),
    onSuccess: () => {
      toast.success('Approved')
      refresh()
    },
    onError: () => toast.error('Could not approve'),
  })
  const reject = useMutation({
    mutationFn: () => rejectVideo(jobId, rejectReason.trim()),
    onSuccess: () => {
      toast.success('Rejected')
      setRejecting(false)
      setRejectReason('')
      refresh()
    },
    onError: () => toast.error('Could not reject'),
  })
  const comment = useMutation({
    mutationFn: () => addVideoComment(jobId, draft.trim()),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['video-comments', jobId] })
      qc.invalidateQueries({ queryKey: ['video-review', jobId] })
    },
    onError: () => toast.error('Could not add comment'),
  })
  const toggle = useMutation({
    mutationFn: (c: { id: string; resolved: 'open' | 'resolved' }) =>
      resolveVideoComment(c.id, c.resolved === 'open' ? 'resolved' : 'open'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video-comments', jobId] }),
  })

  const list = comments.data ?? []
  const openCount = list.filter((c) => c.resolved === 'open').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Review</h2>
        <Badge
          variant="secondary"
          className={`uppercase tracking-wide ${STATUS_STYLE[status] ?? ''}`}
        >
          {status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Manager actions */}
      {role === 'manager' && status === 'in_review' && !rejecting && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={approve.isPending}
            onClick={() => approve.mutate()}
          >
            <ThumbsUp className="mr-1 h-4 w-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-destructive"
            onClick={() => setRejecting(true)}
          >
            <ThumbsDown className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      )}

      {role === 'manager' && status === 'in_review' && rejecting && (
        <div className="space-y-1.5 rounded-md border border-destructive/30 p-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Rejection reason (required)</FieldLabel>
            <span
              className={`text-[10px] ${rejectWords > 100 ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {rejectWords}/100 words
            </span>
          </div>
          <textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain what needs to change…"
            className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRejecting(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={!rejectValid || reject.isPending}
              onClick={() => reject.mutate()}
            >
              <ThumbsDown className="mr-1 h-4 w-4" /> Confirm rejection
            </Button>
          </div>
        </div>
      )}

      {status === 'rejected' && review.data?.note && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
            Rejection reason
          </p>
          <p>{review.data.note}</p>
        </div>
      )}

      {/* Manager: add a whole-video comment */}
      {role === 'manager' && (status === 'in_review') && (
        <div className="space-y-1.5 rounded-md border border-border p-2">
          <FieldLabel>Comment on this video</FieldLabel>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Leave feedback…"
            className="min-h-16 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={!draft.trim() || comment.isPending}
            onClick={() => comment.mutate()}
          >
            <MessageSquare className="mr-1 h-4 w-4" /> Add comment
          </Button>
        </div>
      )}

      {/* Comments list */}
      {list.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Feedback ({openCount} open)
          </p>
          {list.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border p-2 text-sm ${
                c.resolved === 'resolved'
                  ? 'border-border bg-muted/40 opacity-70'
                  : 'border-amber-200 bg-amber-50/60'
              }`}
            >
              <div className="mb-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => toggle.mutate({ id: c.id, resolved: c.resolved })}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Check className="h-3 w-3" />
                  {c.resolved === 'open' ? 'Resolve' : 'Reopen'}
                </button>
              </div>
              <p className={c.resolved === 'resolved' ? 'line-through' : ''}>{c.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
