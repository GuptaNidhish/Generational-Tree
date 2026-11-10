import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { slideIn, staggerIn } from '../lib/animations'
import type { FamilyIndex } from '../lib/family'
import { childWord, siblingsOf, toRoman } from '../lib/generations'
import { generationColor } from '../lib/palette'
import type { AdminUser, Person, VisitorComment } from '../types'
import { CommentCard } from './CommentCard'
import { CommentForm } from './CommentForm'
import { QuietButton } from './fields'
import { GenderMark } from './GenderMark'
import { PersonForm } from './PersonForm'

type Props = {
  person: Person | null
  family: FamilyIndex
  persons: Person[]
  describe: (p: Person) => string | null
  admin: AdminUser | null
  // open visitor comments about this person (admins only)
  comments: VisitorComment[]
  onSelect: (id: number) => void
  onShowInTree: (id: number) => void
  onSaved: (person: Person, kind: 'edited' | 'child') => Promise<void>
  onCommentsChanged: () => void
  onClose: () => void
}

// Edit details / add a child, for signed-in admins
function AdminTools({ person, onSaved }: { person: Person; onSaved: Props['onSaved'] }) {
  const [mode, setMode] = useState<'edit' | 'child' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const open = (next: 'edit' | 'child') => {
    setNotice(null)
    setMode(next)
  }

  return (
    <section className="mt-6 rounded-xl border border-wine/25 bg-wine/[0.03] p-4" aria-label="Admin tools">
      <h3 className="font-display text-[1.125rem] text-wine">Admin</h3>
      {notice && (
        <p role="status" className="mt-2 text-[0.9375rem] text-ink">
          {notice}
        </p>
      )}
      {mode === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <QuietButton onClick={() => open('edit')}>Edit details</QuietButton>
          <QuietButton onClick={() => open('child')}>Add a child</QuietButton>
        </div>
      )}
      {mode !== null && (
        <div className="mt-3">
          {mode === 'edit' ? (
            <PersonForm
              mode="edit"
              person={person}
              onCancel={() => setMode(null)}
              onSaved={async (saved) => {
                await onSaved(saved, 'edited')
                setMode(null)
                setNotice('Saved. The tree now shows the new details.')
              }}
            />
          ) : (
            <PersonForm
              mode="child"
              parent={person}
              onCancel={() => setMode(null)}
              onSaved={async (saved) => {
                await onSaved(saved, 'child')
                setMode(null)
                setNotice(`${saved.displayName} has been added to generation ${toRoman(saved.generationNumber)}.`)
              }}
            />
          )}
        </div>
      )}
    </section>
  )
}

// "Know something we've missed?" for every visitor
function VisitorNote({ person, persons, describe }: { person: Person; persons: Person[]; describe: Props['describe'] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-8 border-t border-gold/35 pt-6">
      <h3 className="font-display text-[1.25rem] text-wine">Know something we've missed?</h3>
      <p className="mt-1 text-[0.9375rem] text-ink-soft">
        If a child of {person.firstName || person.displayName} is missing, or something here is wrong, tell the family admins. They will check and update the tree.
      </p>
      <div className="mt-4">
        {open ? (
          <CommentForm person={person} persons={persons} describe={describe} />
        ) : (
          <QuietButton onClick={() => setOpen(true)}>Tell the family admins</QuietButton>
        )}
      </div>
    </section>
  )
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
  if (people.length === 0) return null
  return (
    <section className="mt-7" data-animate>
      <h3 className="font-display text-[1.25rem] text-wine">
        {title} <span className="font-sans text-[0.9375rem] text-ink-soft">({people.length})</span>
      </h3>
      <ul className="mt-2 divide-y divide-gold/25 overflow-hidden rounded-xl border border-gold/35 bg-paper">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className="group flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gold/10"
            >
              <span aria-hidden className="h-5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: generationColor(p.generationNumber) }} />
              <span className="flex-1 truncate text-[1rem] text-ink group-hover:text-wine">{p.displayName}</span>
              <GenderMark gender={p.gender} className="text-[0.8rem] text-gold-ink" />
              <span className="font-display text-[0.875rem]" style={{ color: generationColor(p.generationNumber) }}>
                <span className="sr-only">Generation </span>
                {toRoman(p.generationNumber)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ProfilePanel({ person, family, persons, describe, admin, comments, onSelect, onShowInTree, onSaved, onCommentsChanged, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const isPhone = useMediaQuery('(max-width: 639px)')
  const open = person !== null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Slide in when opening; remember where focus came from and give it back on close
  useEffect(() => {
    if (!open) {
      returnFocus.current?.focus({ preventScroll: true })
      returnFocus.current = null
      return
    }
    if (!returnFocus.current && document.activeElement instanceof HTMLElement && !panelRef.current?.contains(document.activeElement)) {
      returnFocus.current = document.activeElement
      if (panelRef.current) slideIn(panelRef.current, isPhone)
    }
    closeRef.current?.focus({ preventScroll: true })
  }, [open, isPhone])

  // Sections settle in whenever a different person is shown
  useEffect(() => {
    if (person && contentRef.current) staggerIn(contentRef.current.querySelectorAll('[data-animate]'), 0.08)
  }, [person])

  const parent = person ? family.parentsOf.get(person.id)?.[0] : undefined
  const relation = person ? childWord(person.gender) : null
  const color = person ? generationColor(person.generationNumber) : undefined

  return (
    <>
      {isPhone && open && <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-ink/35" />}

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal={isPhone}
        aria-labelledby="profile-name"
        aria-hidden={!open}
        inert={!open}
        className={
          isPhone
            ? `fixed inset-x-0 bottom-0 z-50 max-h-[85svh] overflow-y-auto rounded-t-3xl border-t border-gold/50 bg-ivory pb-10 transition-[transform,visibility] duration-300 ${
                open ? 'visible translate-y-0 shadow-[0_-20px_40px_-20px_rgb(74_14_26_/_0.5)]' : 'invisible pointer-events-none translate-y-full'
              }`
            : `fixed top-0 right-0 bottom-0 z-50 w-[26rem] overflow-y-auto border-l border-gold/50 bg-ivory transition-[transform,visibility] duration-300 ${
                open ? 'visible translate-x-0 shadow-[-24px_0_48px_-28px_rgb(74_14_26_/_0.55)]' : 'invisible pointer-events-none translate-x-full'
              }`
        }
      >
        {isPhone && (
          <div aria-hidden className="sticky top-0 z-10 flex justify-center bg-ivory pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-gold/50" />
          </div>
        )}

        {person && (
          <div ref={contentRef} className="px-6 pt-4 pb-8 sm:px-8 sm:pt-7">
            <div className="flex items-center justify-between gap-4" data-animate>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.9375rem] text-paper" style={{ backgroundColor: color }}>
                Generation <span className="font-display">{toRoman(person.generationNumber)}</span>
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close profile"
                className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-soft transition-colors hover:bg-gold/15 hover:text-ink"
              >
                <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h2 id="profile-name" className="mt-5 font-display text-[2rem] leading-[1.15] text-wine sm:text-[2.25rem]" data-animate>
              {person.displayName}
            </h2>
            {parent && relation && (
              <p className="mt-1 text-[1.0625rem] text-ink-soft" data-animate>
                {relation} of{' '}
                <button type="button" onClick={() => onSelect(parent.id)} className="cursor-pointer text-ink underline decoration-gold/60 underline-offset-4 hover:text-wine">
                  {parent.displayName}
                </button>
              </p>
            )}

            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-gold/35 py-4 text-[1rem]" data-animate>
              {person.salutation && (
                <>
                  <dt className="text-ink-soft">Salutation</dt>
                  <dd className="text-ink">{person.salutation}</dd>
                </>
              )}
              <dt className="text-ink-soft">Given name</dt>
              <dd className="text-ink">{[person.firstName, person.middleName].filter(Boolean).join(' ') || '—'}</dd>
              <dt className="text-ink-soft">Surname</dt>
              <dd className="text-ink">{person.surname || '—'}</dd>
              <dt className="text-ink-soft">Gender</dt>
              <dd className="text-ink">{person.gender}</dd>
              <dt className="text-ink-soft">Generation</dt>
              <dd className="text-ink">{person.generationNumber}</dd>
            </dl>

            <button
              type="button"
              onClick={() => onShowInTree(person.id)}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-wine bg-wine px-4 py-2 text-[0.9375rem] font-medium text-paper transition-colors hover:bg-wine-deep"
              data-animate
            >
              <svg aria-hidden className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a.75.75 0 01.75.75v1.5a5.75 5.75 0 015 5h1.5a.75.75 0 010 1.5h-1.5a5.75 5.75 0 01-5 5v1.5a.75.75 0 01-1.5 0v-1.5a5.75 5.75 0 01-5-5h-1.5a.75.75 0 010-1.5h1.5a5.75 5.75 0 015-5v-1.5A.75.75 0 0110 2zm0 5a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
              Show in the tree
            </button>

            {admin && <AdminTools key={`admin-${person.id}`} person={person} onSaved={onSaved} />}
            {admin && comments.length > 0 && (
              <section className="mt-6">
                <h3 className="font-display text-[1.25rem] text-wine">
                  Comments about {person.firstName || 'this person'} <span className="font-sans text-[0.9375rem] text-ink-soft">({comments.length})</span>
                </h3>
                <div className="mt-2 space-y-3">
                  {comments.map((c) => (
                    <CommentCard key={c.id} comment={c} showPerson={false} onJump={onSelect} onReviewed={onCommentsChanged} />
                  ))}
                </div>
              </section>
            )}

            <RelativeList title="Parent" people={parent ? [parent] : []} onSelect={onSelect} />
            <RelativeList title="Siblings" people={siblingsOf(family, person.id)} onSelect={onSelect} />
            <RelativeList title="Children" people={family.childrenOf.get(person.id) ?? []} onSelect={onSelect} />

            <section className="mt-8" data-animate>
              <h3 className="font-display text-[1.25rem] text-wine">Line of descent</h3>
              <p className="text-[0.9375rem] text-ink-soft">From the eldest ancestor down to {person.firstName}</p>
              <ol className="mt-4 space-y-2.5 border-l border-gold pl-5">
                {lineOfDescent(family, person).map((p) => {
                  const isCurrent = p.id === person.id
                  return (
                    <li key={p.id} className="relative text-[1rem]">
                      <span
                        aria-hidden
                        className={`absolute top-1/2 -left-[25px] size-2.5 -translate-y-1/2 rotate-45 ${isCurrent ? 'ring-2 ring-gold-light' : ''}`}
                        style={{ backgroundColor: generationColor(p.generationNumber) }}
                      />
                      {isCurrent ? (
                        <span className="font-semibold text-ink">{p.displayName}</span>
                      ) : (
                        <button type="button" onClick={() => onSelect(p.id)} className="cursor-pointer text-left text-ink hover:text-wine hover:underline">
                          {p.displayName}
                        </button>
                      )}{' '}
                      <span className="font-display text-[0.875rem]" style={{ color: generationColor(p.generationNumber) }}>
                        <span className="sr-only">generation </span>
                        {toRoman(p.generationNumber)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>

            <VisitorNote key={`note-${person.id}`} person={person} persons={persons} describe={describe} />
          </div>
        )}
      </aside>
    </>
  )
}
