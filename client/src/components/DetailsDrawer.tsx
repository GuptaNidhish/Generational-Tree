import { useEffect, useRef } from 'react'
import type { FamilyIndex } from '../lib/family'
import { generationColor } from '../lib/palette'
import type { Person } from '../types'
import { GenderMark } from './GenderMark'

export const DRAWER_WIDTH = 380

type Props = {
  person: Person | null
  family: FamilyIndex
  onSelect: (id: number) => void
  onClose: () => void
}

// Root-first chain of ancestors, ending with the person
function lineOfDescent(family: FamilyIndex, person: Person): Person[] {
  const chain = [person]
  let current = family.parentsOf.get(person.id)?.[0]
  while (current && !chain.includes(current)) {
    chain.unshift(current)
    current = family.parentsOf.get(current.id)?.[0]
  }
  return chain
}

function RelativeList({ title, people, onSelect }: { title: string; people: Person[]; onSelect: (id: number) => void }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-ink-soft">
        {title} <span className="font-normal">({people.length})</span>
      </h3>
      {people.length === 0 ? (
        <p className="mt-1 text-[15px] text-ink-soft">None recorded</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-ink/10 border-y border-ink/10">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex w-full cursor-pointer items-center gap-2 py-2 text-left text-[15px] hover:bg-haldi-wash"
              >
                <span aria-hidden className="h-5 w-1 shrink-0 rounded-sm" style={{ backgroundColor: generationColor(p.generationNumber) }} />
                <span className="flex-1 truncate">{p.displayName}</span>
                <GenderMark gender={p.gender} className="text-ink-soft" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DetailsDrawer({ person, family, onSelect, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = person !== null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (person) closeRef.current?.focus({ preventScroll: true })
  }, [person])

  return (
    <aside
      aria-label="Person details"
      style={{ '--drawer-width': `${DRAWER_WIDTH}px` } as React.CSSProperties}
      aria-hidden={!open}
      inert={!open}
      className={`absolute top-0 right-0 bottom-0 z-10 w-full overflow-y-auto border-l border-ink/15 bg-paper transition-transform duration-300 ease-out motion-reduce:transition-none sm:w-(--drawer-width) ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {person && (
        <div className="px-6 pt-5 pb-8">
          <div className="flex items-start justify-between gap-4">
            <span
              className="mt-1 rounded-full px-2.5 py-0.5 text-sm font-semibold text-paper"
              style={{ backgroundColor: generationColor(person.generationNumber) }}
            >
              Generation {person.generationNumber}
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="cursor-pointer rounded-md px-2 py-1 text-2xl leading-none text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              ×
            </button>
          </div>

          <h2 className="mt-4 font-display text-[32px] leading-[1.1] text-ink">{person.displayName}</h2>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[15px]">
            {person.salutation && (
              <>
                <dt className="text-ink-soft">Salutation</dt>
                <dd>{person.salutation}</dd>
              </>
            )}
            <dt className="text-ink-soft">Given name</dt>
            <dd>{[person.firstName, person.middleName].filter(Boolean).join(' ')}</dd>
            <dt className="text-ink-soft">Surname</dt>
            <dd>{person.surname}</dd>
            <dt className="text-ink-soft">Gender</dt>
            <dd>{person.gender}</dd>
          </dl>

          <RelativeList title="Parents" people={family.parentsOf.get(person.id) ?? []} onSelect={onSelect} />
          <RelativeList title="Children" people={family.childrenOf.get(person.id) ?? []} onSelect={onSelect} />

          <section className="mt-6">
            <h3 className="text-sm font-semibold text-ink-soft">Line of descent</h3>
            <ol className="mt-2 border-l-2 border-haldi pl-4">
              {lineOfDescent(family, person).map((p) => (
                <li key={p.id} className="relative py-1 text-[15px]">
                  <span
                    aria-hidden
                    className="absolute top-1/2 -left-[21px] size-2 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: generationColor(p.generationNumber) }}
                  />
                  {p.id === person.id ? (
                    <span className="font-semibold">{p.displayName}</span>
                  ) : (
                    <button type="button" onClick={() => onSelect(p.id)} className="cursor-pointer text-left hover:underline">
                      {p.displayName}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </aside>
  )
}
