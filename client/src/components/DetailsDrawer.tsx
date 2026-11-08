import { useEffect, useRef } from 'react'
import { slideInDrawer, staggerIn } from '../lib/animations'
import { useMediaQuery } from '../hooks/useMediaQuery'
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

function RelativeList({
  title,
  people,
  onSelect,
}: {
  title: string
  people: Person[]
  onSelect: (id: number) => void
}) {
  return (
    <section className="mt-5" data-animate>
      <h3 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
        {title} <span className="font-normal text-xs lowercase">({people.length})</span>
      </h3>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft/80 italic">None recorded</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-white/50 backdrop-blur-xs">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[14px] transition-colors hover:bg-haldi-wash/80"
              >
                <span
                  aria-hidden
                  className="h-4 w-1 shrink-0 rounded-full transition-transform group-hover:scale-y-125"
                  style={{ backgroundColor: generationColor(p.generationNumber) }}
                />
                <span className="flex-1 truncate font-medium text-ink group-hover:text-bahi-deep">
                  {p.displayName}
                </span>
                <span className="text-xs text-ink-soft">Gen {p.generationNumber}</span>
                <GenderMark gender={p.gender} className="text-ink-soft text-[12px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DetailsDrawer({ person, family, onSelect, onClose }: Props) {
  const drawerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const open = person !== null

  // Keyboard escape handler
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus trap / focus close button
  useEffect(() => {
    if (person) closeRef.current?.focus({ preventScroll: true })
  }, [person])

  // GSAP slide in and stagger sections when a person is loaded
  useEffect(() => {
    if (person && drawerRef.current) {
      slideInDrawer(drawerRef.current, isMobile)
      if (contentRef.current) {
        const animEls = contentRef.current.querySelectorAll('[data-animate]')
        if (animEls.length > 0) {
          staggerIn(animEls, 0.08)
        }
      }
    }
  }, [person, isMobile])

  return (
    <>
      {/* Dim backdrop on mobile */}
      {isMobile && open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-20 bg-ink/30 backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      <aside
        ref={drawerRef}
        aria-label="Person details"
        style={{ '--drawer-width': `${DRAWER_WIDTH}px` } as React.CSSProperties}
        aria-hidden={!open}
        inert={!open}
        className={
          isMobile
            ? `fixed right-0 bottom-0 left-0 z-30 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-ink/15 bg-paper shadow-2xl pb-8 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
              }`
            : `absolute top-0 right-0 bottom-0 z-10 w-full overflow-y-auto border-l border-ink/15 bg-paper/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ease-out motion-reduce:transition-none sm:w-(--drawer-width) ${
                open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
              }`
        }
      >
        {/* Mobile drag handle indicator */}
        {isMobile && (
          <div className="sticky top-0 z-10 flex justify-center bg-paper/90 pt-3 pb-1 backdrop-blur-xs">
            <div className="h-1.5 w-12 rounded-full bg-ink/20" />
          </div>
        )}

        {person && (
          <div ref={contentRef} className="px-6 pt-3 pb-8 sm:pt-5">
            <div className="flex items-start justify-between gap-4" data-animate>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide text-paper shadow-xs"
                style={{ backgroundColor: generationColor(person.generationNumber) }}
              >
                <span>Generation {person.generationNumber}</span>
                <GenderMark gender={person.gender} className="text-[12px] opacity-90" />
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="cursor-pointer rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-haldi focus:outline-none"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h2
              className="mt-3 font-display text-[28px] leading-[1.15] font-bold text-ink sm:text-[32px]"
              data-animate
            >
              {person.displayName}
            </h2>

            <div
              className="mt-4 rounded-xl border border-ink/10 bg-white/60 p-3.5 backdrop-blur-xs"
              data-animate
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {person.salutation && (
                  <>
                    <dt className="text-ink-soft font-medium">Salutation</dt>
                    <dd className="font-semibold text-ink">{person.salutation}</dd>
                  </>
                )}
                <dt className="text-ink-soft font-medium">Given name</dt>
                <dd className="font-semibold text-ink">
                  {[person.firstName, person.middleName].filter(Boolean).join(' ')}
                </dd>
                <dt className="text-ink-soft font-medium">Surname</dt>
                <dd className="font-semibold text-ink">{person.surname}</dd>
                <dt className="text-ink-soft font-medium">Gender</dt>
                <dd className="font-semibold text-ink">{person.gender}</dd>
              </dl>
            </div>

            <RelativeList
              title="Parents"
              people={family.parentsOf.get(person.id) ?? []}
              onSelect={onSelect}
            />
            <RelativeList
              title="Children"
              people={family.childrenOf.get(person.id) ?? []}
              onSelect={onSelect}
            />

            <section className="mt-6" data-animate>
              <h3 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                Line of descent
              </h3>
              <p className="mt-0.5 text-xs text-ink-soft">From the root ancestor to this person</p>
              <ol className="mt-3 space-y-2 border-l-2 border-haldi/70 pl-4">
                {lineOfDescent(family, person).map((p) => {
                  const isCurrent = p.id === person.id
                  return (
                    <li key={p.id} className="relative text-[14px]">
                      <span
                        aria-hidden
                        className={`absolute top-1/2 -left-[21px] size-2.5 -translate-y-1/2 rounded-full transition-transform ${
                          isCurrent ? 'ring-2 ring-haldi scale-125' : ''
                        }`}
                        style={{ backgroundColor: generationColor(p.generationNumber) }}
                      />
                      {isCurrent ? (
                        <span className="font-bold text-ink">
                          {p.displayName}{' '}
                          <span className="text-xs font-normal text-ink-soft">(Gen {p.generationNumber})</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(p.id)}
                          className="cursor-pointer text-left text-ink hover:text-bahi-deep hover:underline focus-visible:underline focus:outline-none"
                        >
                          {p.displayName}{' '}
                          <span className="text-xs text-ink-soft">(Gen {p.generationNumber})</span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </>
  )
}
