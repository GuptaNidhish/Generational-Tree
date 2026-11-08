import { useCallback, useEffect, useState } from 'react'
import { ApiError, listComments } from '../api'
import type { CommentStatus, VisitorComment } from '../types'
import { CommentCard } from './CommentCard'
import { Dialog } from './Dialog'

type Props = {
  onClose: () => void
  onJump: (personId: number) => void
  onChanged: () => void
}

const FILTERS: { value: CommentStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

// The admins' review queue for visitor comments
export function CommentsReview({ onClose, onJump, onChanged }: Props) {
  const [status, setStatus] = useState<CommentStatus>('new')
  const [comments, setComments] = useState<VisitorComment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listComments(status).then(
      (list) => {
        setComments(list)
        setError(null)
      },
      (err) => setError(err instanceof ApiError ? err.message : "Couldn't load comments. Try again.")
    )
  }, [status])
  useEffect(load, [load])

  return (
    <Dialog title="Comments from visitors" description="Call to confirm if you need to, update the tree, then mark each one resolved." onClose={onClose} wide>
      <div role="tablist" aria-label="Show comments" className="flex gap-1 rounded-full border border-gold/40 bg-paper p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={status === f.value}
            onClick={() => {
              setComments(null)
              setStatus(f.value)
            }}
            className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[0.9375rem] font-medium transition-colors ${
              status === f.value ? 'bg-wine text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {error && <p className="text-wine">{error}</p>}
        {comments === null && !error && <p className="text-ink-soft">Loading…</p>}
        {comments?.length === 0 && (
          <p className="rounded-xl border border-dashed border-gold/50 px-4 py-6 text-center text-ink-soft">
            {status === 'new' ? 'Nothing waiting. New comments from visitors will appear here.' : `No ${status} comments yet.`}
          </p>
        )}
        {comments?.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            onJump={(id) => {
              onClose()
              onJump(id)
            }}
            onReviewed={() => {
              load()
              onChanged()
            }}
          />
        ))}
      </div>
    </Dialog>
  )
}
