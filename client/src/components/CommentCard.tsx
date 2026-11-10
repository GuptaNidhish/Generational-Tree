import { useState } from 'react'
import { ApiError, reviewComment } from '../api'
import { formatPhone } from '../lib/forms'
import { toRoman } from '../lib/generations'
import type { CommentStatus, VisitorComment } from '../types'
import { inputClass } from './fields'

type Props = {
  comment: VisitorComment
  onJump?: (personId: number) => void
  onReviewed: () => void
  showPerson?: boolean
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function PersonLink({ id, name, generation, onJump }: { id: number; name: string; generation: number; onJump?: (id: number) => void }) {
  const label = (
    <>
      {name} <span className="font-display text-[0.8125rem] text-gold-ink">{toRoman(generation)}</span>
    </>
  )
  if (!onJump) return <span className="font-medium text-ink">{label}</span>
  return (
    <button type="button" onClick={() => onJump(id)} className="cursor-pointer font-medium text-ink underline decoration-gold/60 underline-offset-4 hover:text-wine">
      {label}
    </button>
  )
}

// One visitor comment, with the admin's Resolve / Dismiss actions
export function CommentCard({ comment: c, onJump, onReviewed, showPerson = true }: Props) {
  const [note, setNote] = useState(c.adminNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function review(status: CommentStatus) {
    setBusy(true)
    setError(null)
    try {
      await reviewComment(c.id, status, note)
      onReviewed()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-xl border border-gold/40 bg-paper p-4">
      {showPerson && (
        <p className="text-[0.9375rem] text-ink-soft">
          About <PersonLink id={c.person.id} name={c.person.displayName} generation={c.person.generationNumber} onJump={onJump} />
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-ink">{c.message}</p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9375rem]">
        <dt className="text-ink-soft">From</dt>
        <dd className="text-ink">{c.name}</dd>
        <dt className="text-ink-soft">Phone</dt>
        <dd>
          <a href={`tel:${c.phone}`} className="text-ink underline decoration-gold/60 underline-offset-4 hover:text-wine">
            {formatPhone(c.phone)}
          </a>
        </dd>
        <dt className="text-ink-soft">In the tree</dt>
        <dd className="text-ink">
          {c.link === 'none' || !c.linkedPerson ? (
            'No, or not sure'
          ) : (
            <>
              {c.link === 'self' ? 'Is ' : 'Descends from '}
              <PersonLink id={c.linkedPerson.id} name={c.linkedPerson.displayName} generation={c.linkedPerson.generationNumber} onJump={onJump} />
              {c.relation && <span className="text-ink-soft"> — “{c.relation}”</span>}
            </>
          )}
        </dd>
        <dt className="text-ink-soft">Sent</dt>
        <dd className="text-ink">{when(c.createdAt)}</dd>
        {c.status !== 'new' && (
          <>
            <dt className="text-ink-soft">{c.status === 'resolved' ? 'Resolved' : 'Dismissed'}</dt>
            <dd className="text-ink">
              {c.resolvedBy ? `by ${c.resolvedBy.username}` : 'by a removed admin'}
              {c.resolvedAt ? `, ${when(c.resolvedAt)}` : ''}
            </dd>
          </>
        )}
      </dl>

      <label className="mt-3 block">
        <span className="text-[0.875rem] text-ink-soft">Note for other admins (optional)</span>
        <input className={`${inputClass} mt-1 !py-1.5 !text-[0.9375rem]`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Called her, added Kamla" />
      </label>
      {error && <p className="mt-2 text-[0.875rem] text-wine">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {c.status === 'new' ? (
          <>
            <button type="button" disabled={busy} onClick={() => review('resolved')} className="cursor-pointer rounded-full bg-wine px-4 py-1.5 text-[0.9375rem] font-medium text-paper hover:bg-wine-deep disabled:opacity-60">
              Mark resolved
            </button>
            <button type="button" disabled={busy} onClick={() => review('dismissed')} className="cursor-pointer rounded-full border border-gold/50 px-4 py-1.5 text-[0.9375rem] font-medium text-gold-ink hover:border-gold hover:text-wine disabled:opacity-60">
              Dismiss
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => review('new')} className="cursor-pointer rounded-full border border-gold/50 px-4 py-1.5 text-[0.9375rem] font-medium text-gold-ink hover:border-gold hover:text-wine disabled:opacity-60">
            Move back to new
          </button>
        )}
      </div>
    </article>
  )
}
