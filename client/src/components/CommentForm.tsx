import { useCallback, useState } from 'react'
import { ApiError, sendComment } from '../api'
import { formatPhone, normalisePhone } from '../lib/forms'
import type { Person, CommenterLink } from '../types'
import { Field, FormError, inputClass, PrimaryButton } from './fields'
import { SearchBox } from './SearchBox'
import { turnstileEnabled } from '../lib/turnstile'
import { Turnstile } from './Turnstile'

type Props = {
  person: Person
  persons: Person[]
  describe: (p: Person) => string | null
}

const LINKS: { value: CommenterLink; label: string }[] = [
  { value: 'self', label: "Yes, I'm in the tree" },
  { value: 'ancestor', label: 'Yes, an ancestor of mine is' },
  { value: 'none', label: 'No / not sure' },
]

const CHECK_UNAVAILABLE =
  "The “not a robot” check couldn't load. An ad blocker or a weak connection can stop it: please allow this site in your blocker, or try again later."

// A visitor tells the family admins about someone or something we've missed
export function CommentForm({ person, persons, describe }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [link, setLink] = useState<CommenterLink | null>(null)
  const [linked, setLinked] = useState<Person | null>(null)
  const [relation, setRelation] = useState('')
  const [message, setMessage] = useState('')
  const [token, setToken] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ name: string; phone: string } | null>(null)
  const [checkUnavailable, setCheckUnavailable] = useState(false)
  const turnstileUnavailable = useCallback(() => {
    setCheckUnavailable(true)
    setError(CHECK_UNAVAILABLE)
  }, [])

  const normalised = normalisePhone(phone)
  const phoneError = phoneTouched && phone && !normalised ? 'Enter a mobile number like 98765 43210, or +44 7700 900123 from abroad.' : null
  const inTree = link === 'self' || link === 'ancestor'

  function problem(): string | null {
    if (name.trim().length < 2) return 'Please tell us your name.'
    if (!normalised) return 'Please enter a valid mobile number.'
    if (!link) return 'Please say whether you or an ancestor are in the tree.'
    if (inTree && !linked) return link === 'self' ? 'Please choose which person in the tree is you.' : 'Please choose your ancestor in the tree.'
    if (inTree && !relation.trim()) return 'Please say how you are related.'
    if (message.trim().length < 5) return 'Please tell us a little more in your message.'
    if (turnstileEnabled && !token) return checkUnavailable ? CHECK_UNAVAILABLE : 'Please complete the check below so we know you are not a robot.'
    return null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPhoneTouched(true)
    const p = problem()
    if (p) return setError(p)
    setBusy(true)
    setError(null)
    try {
      const res = await sendComment(person.id, {
        name: name.trim(),
        phone,
        link: link!,
        linkedPersonId: inTree ? linked!.id : null,
        relation: inTree ? relation.trim() : '',
        message: message.trim(),
        turnstileToken: token,
      })
      setSent({ name: name.trim(), phone: res.phone })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection and try again.")
      // tokens are single-use: get a fresh challenge
      setToken('')
      setResetKey((k) => k + 1)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-4 text-ink">
        <p className="font-medium">Thank you, {sent.name}.</p>
        <p className="mt-1 text-[0.9375rem] text-ink-soft">
          An admin will review this and may call you on {formatPhone(sent.phone)} to confirm the details.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} onChange={() => setError(null)} noValidate className="space-y-4">
      <Field label="Your name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </Field>

      <Field label="Mobile number" hint="Only the family admins see this, to call you back if needed." error={phoneError}>
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          aria-invalid={Boolean(phoneError)}
          required
        />
      </Field>

      <fieldset>
        <legend className="text-[0.9375rem] font-medium text-ink">Are you, or one of your ancestors, in this family tree?</legend>
        <div className="mt-2 grid gap-2">
          {LINKS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[0.9375rem] transition-colors ${
                link === option.value ? 'border-wine bg-paper text-ink' : 'border-gold/40 bg-paper/60 text-ink hover:border-gold'
              }`}
            >
              <input
                type="radio"
                name="link"
                value={option.value}
                checked={link === option.value}
                onChange={() => {
                  setLink(option.value)
                  if (option.value === 'none') setLinked(null)
                }}
                className="accent-wine"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {inTree && (
        <>
          <div>
            <span className="text-[0.9375rem] font-medium text-ink">{link === 'self' ? 'Which person is you?' : 'Which ancestor?'}</span>
            <div className="mt-1">
              {linked ? (
                <div className="flex items-center gap-3 rounded-lg border border-gold/45 bg-paper px-3 py-2">
                  <span className="flex-1">
                    <span className="block text-ink">{linked.displayName}</span>
                    {describe(linked) && <span className="block text-[0.875rem] text-ink-soft">{describe(linked)}</span>}
                  </span>
                  <button type="button" onClick={() => setLinked(null)} className="cursor-pointer text-[0.875rem] font-medium text-gold-ink hover:text-wine">
                    Change
                  </button>
                </div>
              ) : (
                <SearchBox
                  persons={persons}
                  onSelect={setLinked}
                  describe={describe}
                  label={link === 'self' ? 'Find yourself in the tree' : 'Find your ancestor in the tree'}
                  placeholder="Type a name from the tree"
                />
              )}
            </div>
          </div>
          <Field label="How are you related?" hint={link === 'self' ? 'e.g. "That is me" or "I am listed under my maiden name"' : 'e.g. "I am his granddaughter", "His son\'s wife"'}>
            <input className={inputClass} value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={200} />
          </Field>
        </>
      )}

      <Field label="What should we know?" hint={`For example, a child of ${person.firstName || person.displayName} who isn't listed, or a name that's spelt wrong.`}>
        <textarea className={`${inputClass} min-h-28`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
      </Field>

      <Turnstile onToken={setToken} resetKey={resetKey} onUnavailable={turnstileUnavailable} />
      <FormError message={error} />
      <PrimaryButton type="submit" busy={busy} className="w-full sm:w-auto">
        Send to the family admins
      </PrimaryButton>
    </form>
  )
}
