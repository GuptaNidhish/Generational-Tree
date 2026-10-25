import { generationColor } from '../lib/palette'

type Props = {
  generations: number[]
  selected: Set<number>
  onChange: (selected: Set<number>) => void
}

// Toggle chips; with none selected every generation is shown
export function GenerationFilter({ generations, selected, onChange }: Props) {
  function toggle(generation: number) {
    const next = new Set(selected)
    if (next.has(generation)) next.delete(generation)
    else next.add(generation)
    onChange(next)
  }

  return (
    <div role="group" aria-label="Show generations" className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only mr-1 text-sm text-kora/80 sm:not-sr-only">Generations</span>
      {generations.map((g) => {
        const on = selected.has(g)
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            aria-label={`Generation ${g}`}
            onClick={() => toggle(g)}
            className={`h-8 min-w-8 cursor-pointer rounded-full border px-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${
              on ? 'border-haldi bg-haldi text-ink' : 'border-kora/30 text-kora hover:border-kora/70'
            }`}
          >
            <span aria-hidden className="mr-1 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: generationColor(g) }} />
            {g}
          </button>
        )
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="ml-1 cursor-pointer text-sm text-kora/80 underline underline-offset-2 hover:text-kora"
        >
          Show all
        </button>
      )}
    </div>
  )
}
