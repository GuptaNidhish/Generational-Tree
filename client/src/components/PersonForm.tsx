import { useState } from 'react'
import { addChild, ApiError, updatePerson } from '../api'
import { composeDisplayName } from '../lib/forms'
import { toRoman } from '../lib/generations'
import type { Person, PersonInput } from '../types'
import { Field, FormError, inputClass, PrimaryButton, QuietButton } from './fields'

type Props =
  // onSaved resolves once the tree on screen shows the change; the button spins until then
  | { mode: 'edit'; person: Person; onSaved: (person: Person) => Promise<void>; onCancel: () => void }
  | { mode: 'child'; parent: Person; onSaved: (person: Person) => Promise<void>; onCancel: () => void }

const SALUTATIONS = ['Sh', 'Smt', 'Late Sh', 'Late Smt', 'Dr', 'Mr', 'Ms', 'Kumari']

function initial(props: Props): PersonInput {
  if (props.mode === 'edit') {
    const p = props.person
    return {
      salutation: p.salutation ?? '',
      firstName: p.firstName,
      middleName: p.middleName ?? '',
      surname: p.surname,
      displayName: p.displayName,
      gender: p.gender === 'Male' || p.gender === 'Female' ? p.gender : '',
    }
  }
  // a new child usually shares the parent's surname
  return { salutation: '', firstName: '', middleName: '', surname: props.parent.surname, displayName: '', gender: '' }
}

// Edit someone's details, or add a child under them (admins only)
export function PersonForm(props: Props) {
  const [form, setForm] = useState<PersonInput>(() => initial(props))
  // the display name follows the name parts until someone types their own
  // (an existing name that was custom-made stays as it is)
  const [displayEdited, setDisplayEdited] = useState(() => {
    if (props.mode !== 'edit') return false
    const start = initial(props)
    return start.displayName !== composeDisplayName(start)
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const composed = composeDisplayName(form)
  const displayName = displayEdited ? form.displayName : composed

  function set<K extends keyof PersonInput>(key: K, value: PersonInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim()) return setError('First name is required.')
    if (!form.surname.trim()) return setError('Surname is required.')
    if (!form.gender) return setError('Please choose Male or Female.')
    setBusy(true)
    setError(null)
    const input = { ...form, displayName: displayName.trim() || composed }
    try {
      const saved = props.mode === 'edit' ? await updatePerson(props.person.id, input) : await addChild(props.parent.id, input)
      await props.onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError && err.status > 0 ? err.message : "Couldn't reach the server. Your changes weren't saved; try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} onChange={() => setError(null)} noValidate className="space-y-4">
      {props.mode === 'child' && (
        <p className="text-[0.9375rem] text-ink-soft">
          Generation <span className="font-display text-ink">{toRoman(props.parent.generationNumber + 1)}</span>, child of{' '}
          <span className="font-medium text-ink">{props.parent.displayName}</span>
        </p>
      )}

      <div className="grid gap-4">
        <Field label="Salutation">
          <input className={inputClass} list="salutations" value={form.salutation} onChange={(e) => set('salutation', e.target.value)} placeholder="Sh, Smt…" />
          <datalist id="salutations">
            {SALUTATIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <fieldset>
          <legend className="text-[0.9375rem] font-medium text-ink">Gender</legend>
          <div className="mt-1 flex gap-2">
            {(['Male', 'Female'] as const).map((g) => (
              <label
                key={g}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[0.9375rem] ${
                  form.gender === g ? 'border-wine bg-paper text-ink' : 'border-gold/45 bg-paper/60 text-ink-soft hover:border-gold'
                }`}
              >
                <input type="radio" name={`gender-${props.mode}`} checked={form.gender === g} onChange={() => set('gender', g)} className="accent-wine" />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="First name">
          <input className={inputClass} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
        </Field>
        <Field label="Middle name" hint="Optional">
          <input className={inputClass} value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
        </Field>
        <Field label="Surname">
          <input className={inputClass} value={form.surname} onChange={(e) => set('surname', e.target.value)} required />
        </Field>
      </div>

      <Field label="Name as shown on the tree" hint={displayEdited ? undefined : 'Filled in from the name above. Type to change it.'}>
        <input
          className={inputClass}
          value={displayName}
          onChange={(e) => {
            setDisplayEdited(true)
            set('displayName', e.target.value)
          }}
        />
      </Field>
      {displayEdited && displayName !== composed && (
        <button
          type="button"
          onClick={() => {
            setDisplayEdited(false)
            set('displayName', '')
          }}
          className="-mt-2 cursor-pointer text-[0.875rem] font-medium text-gold-ink hover:text-wine"
        >
          Use “{composed}”
        </button>
      )}

      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" busy={busy}>
          {props.mode === 'edit' ? 'Save changes' : 'Add to the tree'}
        </PrimaryButton>
        <QuietButton onClick={props.onCancel}>Cancel</QuietButton>
      </div>
    </form>
  )
}
