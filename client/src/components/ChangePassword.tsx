import { useState } from 'react'
import { ApiError, changePassword } from '../api'
import { Dialog } from './Dialog'
import { Field, FormError, inputClass, PrimaryButton } from './fields'

export function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 10) return setError('Use a password of at least 10 characters.')
    if (next !== again) return setError("The new passwords don't match.")
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="Change your password" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-ink">Your password has been changed. Use the new one next time you sign in.</p>
          <PrimaryButton type="button" onClick={onClose}>
            Done
          </PrimaryButton>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password">
            <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="New password" hint="At least 10 characters">
            <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="New password again">
            <input type="password" className={inputClass} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </Field>
          <FormError message={error} />
          <PrimaryButton type="submit" busy={busy}>
            Change password
          </PrimaryButton>
        </form>
      )}
    </Dialog>
  )
}
