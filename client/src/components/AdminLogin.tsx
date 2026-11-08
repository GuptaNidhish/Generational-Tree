import { useState } from 'react'
import { ApiError, signIn } from '../api'
import type { AdminUser } from '../types'
import { Dialog } from './Dialog'
import { Field, FormError, inputClass, PrimaryButton } from './fields'

type Props = { onSignedIn: (admin: AdminUser) => void; onClose: () => void }

export function AdminLogin({ onSignedIn, onClose }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await signIn(username, password))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <Dialog title="Admin sign in" description="For family members who look after the tree." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Password">
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <FormError message={error} />
        <PrimaryButton type="submit" busy={busy} className="w-full">
          Sign in
        </PrimaryButton>
      </form>
    </Dialog>
  )
}
