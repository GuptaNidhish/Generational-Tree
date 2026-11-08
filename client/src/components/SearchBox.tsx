import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { searchPersons } from '../lib/family'
import { toRoman } from '../lib/generations'
import { generationColor } from '../lib/palette'
import type { Person } from '../types'
import gsap from 'gsap'

type Props = { persons: Person[]; onSelect: (person: Person) => void; describe?: (person: Person) => string | null }

// Name search with keyboard-navigable suggestions and GSAP animations
export function SearchBox({ persons, onSelect, describe }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchPersons(persons, query), [persons, query])
  const showList = open && query.trim() !== ''

  // GSAP animation for dropdown opening and item staggering
  useEffect(() => {
    if (showList && listRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        listRef.current,
        { opacity: 0, y: -6, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' }
      )
      const items = listRef.current.querySelectorAll('[role="option"]')
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, x: -6 },
          { opacity: 1, x: 0, duration: 0.22, stagger: 0.03, ease: 'power2.out' }
        )
      }
    }
  }, [showList, results])

  function choose(person: Person) {
    onSelect(person)
    setQuery('')
    setOpen(false)
  }

  function clearQuery() {
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {/* Search Icon */}
        <span className="pointer-events-none absolute left-3 text-ink-soft">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Find a family member"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
          placeholder="Search by name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-full border border-gold/45 bg-paper/90 pr-9 pl-9 text-[1rem] text-ink placeholder:text-ink-soft transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_rgb(216_190_135_/_0.45)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="absolute right-2.5 cursor-pointer rounded-full p-1 text-ink-soft hover:bg-ink/10 hover:text-ink focus:outline-none"
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gold/40 bg-paper p-1.5 shadow-[0_18px_40px_-18px_rgb(74_14_26_/_0.55)]"
        >
          {results.length === 0 && (
            <li className="px-4 py-3 text-center text-[0.9375rem] text-ink-soft">
              No one named <span className="font-semibold text-ink">“{query}”</span>. Try part of a first name or surname.
            </li>
          )}
          {results.map((person, i) => (
            <li
              key={person.id}
              id={`${listId}-${person.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(person)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[1rem] transition-colors ${
                i === active ? 'bg-gold/15 text-ink' : 'text-ink'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: generationColor(person.generationNumber) }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{person.displayName}</span>
                  {describe?.(person) && <span className="truncate text-[0.875rem] text-ink-soft">{describe(person)}</span>}
                </span>
              </span>
              <span className="shrink-0 font-display text-[0.875rem]" style={{ color: generationColor(person.generationNumber) }}>
                <span className="sr-only">Generation </span>
                {toRoman(person.generationNumber)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
