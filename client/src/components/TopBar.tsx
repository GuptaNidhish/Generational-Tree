import { useEffect, useRef } from 'react'
import { countUp } from '../lib/animations'
import type { Person } from '../types'
import { GenerationFilter } from './GenerationFilter'
import { SearchBox } from './SearchBox'

type Props = {
  persons: Person[]
  generations: number[]
  selectedGenerations: Set<number>
  onGenerationsChange: (selected: Set<number>) => void
  onFind: (person: Person) => void
  onShowGuide?: () => void
}

export function TopBar({
  persons,
  generations,
  selectedGenerations,
  onGenerationsChange,
  onFind,
  onShowGuide,
}: Props) {
  const root = persons.find((p) => p.generationNumber === generations[0])
  const countSpanRef = useRef<HTMLSpanElement>(null)
  const genSpanRef = useRef<HTMLSpanElement>(null)

  // Animated count up for statistics on mount
  useEffect(() => {
    if (countSpanRef.current) {
      countUp(countSpanRef.current, persons.length, 1.2)
    }
    if (genSpanRef.current) {
      countUp(genSpanRef.current, generations.length, 0.9)
    }
  }, [persons.length, generations.length])

  return (
    <header className="relative z-10 bg-bahi text-kora shadow-md">
      {/* Upper Bar */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-between sm:block">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[26px] tracking-wide leading-none sm:text-[32px]">
                Gupta Vanshavali
              </h1>
              {onShowGuide && (
                <button
                  type="button"
                  onClick={onShowGuide}
                  title="How to navigate"
                  aria-label="How to navigate"
                  className="cursor-pointer rounded-full border border-kora/30 bg-black/15 p-1 text-xs text-kora transition-colors hover:bg-black/30 hover:text-white"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-kora/85 sm:text-sm">
              {root ? (
                <>
                  Descendants of <span className="font-semibold text-kora">{root.displayName}</span> ·{' '}
                </>
              ) : null}
              <span ref={countSpanRef} className="font-bold">
                {persons.length}
              </span>{' '}
              people across{' '}
              <span ref={genSpanRef} className="font-bold">
                {generations.length}
              </span>{' '}
              generations
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <SearchBox persons={persons} onSelect={onFind} />
        </div>
      </div>

      {/* Generation Filter Bar */}
      <div className="border-t border-white/10 bg-black/10 px-4 py-2 sm:px-6">
        <GenerationFilter
          generations={generations}
          selected={selectedGenerations}
          onChange={onGenerationsChange}
        />
      </div>
    </header>
  )
}
