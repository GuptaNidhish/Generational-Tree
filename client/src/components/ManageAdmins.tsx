import { useCallback, useEffect, useState } from 'react'
import { ApiError, createAdmin, listAdmins, removeAdmin } from '../api'
import type { AdminAccount } from '../types'
import { Dialog } from './Dialog'
import { Field, FormError, inputClass, PrimaryButton, QuietButton } from './fields'

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.")

// The owner's screen for adding and removing admins
export function ManageAdmins({ onClose }: { onClose: () => void }) {
  const [admins, setAdmins] = useState<AdminAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)

  const load = useCallback(() => {
    listAdmins().then(setAdmins, (err) => setError(message(err)))
  }, [])
  useEffect(load, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setAdded(null)
    try {
      const created = await createAdmin(username, password)
      setAdded(`${created.username} can now sign in. Pass on their temporary password privately and ask them to change it.`)
      setUsername('')
      setPassword('')
      load()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    setError(null)
    try {
      await removeAdmin(id)
      setConfirming(null)
      load()
    } catch (err) {
      setError(message(err))
    }
  }

  return (
    <Dialog title="Manage admins" description="Admins can edit people, add children and review comments. Only you can add or remove them." onClose={onClose}>
      <ul className="divide-y divide-gold/25 overflow-hidden rounded-xl border border-gold/35 bg-paper">
        {admins === null && <li className="px-4 py-3 text-ink-soft">Loading…</li>}
        {admins?.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="font-medium text-ink">{a.username}</span>
              <span className="block text-[0.875rem] text-ink-soft">
                {a.role === 'owner' ? 'Owner (you)' : `Admin since ${new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </span>
            </span>
            {a.role !== 'owner' &&
              (confirming === a.id ? (
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => remove(a.id)} className="cursor-pointer rounded-full bg-wine px-3 py-1.5 text-[0.875rem] font-medium text-paper hover:bg-wine-deep">
                    Remove {a.username}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="cursor-pointer px-2 text-[0.875rem] text-ink-soft hover:text-ink">
                    Keep
                  </button>
                </span>
              ) : (
                <QuietButton onClick={() => setConfirming(a.id)} className="!px-3 !py-1.5 !text-[0.875rem]">
                  Remove
                </QuietButton>
              ))}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-6 space-y-4 border-t border-gold/35 pt-5">
        <h3 className="font-display text-[1.25rem] text-wine">Add an admin</h3>
        <Field label="Username" hint="Letters, numbers, dots, dashes or underscores">
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="off" required />
        </Field>
        <Field label="Temporary password" hint="At least 10 characters. They can change it after signing in.">
          <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
        </Field>
        <FormError message={error} />
        {added && (
          <p role="status" className="rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-[0.9375rem] text-ink">
            {added}
          </p>
        )}
        <PrimaryButton type="submit" busy={busy}>
          Add admin
        </PrimaryButton>
      </form>
    </Dialog>
  )
}
