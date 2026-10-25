import { useId, useMemo, useState } from 'react'
import { searchPersons } from '../lib/family'
import { generationColor } from '../lib/palette'
import type { Person } from '../types'

type Props = { persons: Person[]; onSelect: (person: Person) => void }

// Name search with keyboard-navigable suggestions (ARIA combobox)
export function SearchBox({ persons, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const results = useMemo(() => searchPersons(persons, query), [persons, query])
  const showList = open && query.trim() !== ''

  function choose(person: Person) {
    onSelect(person)
    setQuery('')
    setOpen(false)
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
    <div className="relative w-full sm:w-80">
      <input
        type="search"
        role="combobox"
        aria-label="Find a family member"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
        placeholder="Find a family member"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-white/20 bg-kora px-3 py-2 text-[15px] text-ink placeholder:text-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border border-ink/15 bg-paper py-1 shadow-lg"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No one by that name in the tree</li>}
          {results.map((person, i) => (
            <li
              key={person.id}
              id={`${listId}-${person.id}`}
              role="option"
              aria-selected={i === active}
              // mousedown keeps focus in the input so blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                choose(person)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${i === active ? 'bg-haldi-wash' : ''}`}
            >
              <span className="truncate text-ink">{person.displayName}</span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: generationColor(person.generationNumber) }}>
                Gen {person.generationNumber}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
