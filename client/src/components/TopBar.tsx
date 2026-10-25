import type { Person } from '../types'
import { GenerationFilter } from './GenerationFilter'
import { SearchBox } from './SearchBox'

type Props = {
  persons: Person[]
  generations: number[]
  selectedGenerations: Set<number>
  onGenerationsChange: (selected: Set<number>) => void
  onFind: (person: Person) => void
}

export function TopBar({ persons, generations, selectedGenerations, onGenerationsChange, onFind }: Props) {
  const root = persons.find((p) => p.generationNumber === generations[0])
  return (
    <header className="relative z-10 bg-bahi text-kora shadow-[inset_0_-3px_0_var(--color-bahi-deep)]">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 pt-3 pb-3 sm:px-6">
        <div className="mr-auto">
          <h1 className="font-display text-[28px] leading-none sm:text-[34px]">Gupta Vanshavali</h1>
          <p className="mt-1 text-sm text-kora/85">
            {root ? `Descendants of ${root.displayName}, ` : ''}
            {persons.length} people across {generations.length} generations
          </p>
        </div>
        <SearchBox persons={persons} onSelect={onFind} />
      </div>
      <div className="border-t border-white/10 px-4 py-2 sm:px-6">
        <GenerationFilter generations={generations} selected={selectedGenerations} onChange={onGenerationsChange} />
      </div>
    </header>
  )
}
