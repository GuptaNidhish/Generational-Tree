import { toRoman } from '../lib/generations'
import { generationColor } from '../lib/palette'

type Props = {
  generations: number[]
  active: number | null
  onJump: (generation: number) => void
  className?: string
}

// Roman numerals for every generation; the one on screen is filled in
export function GenerationNav({ generations, active, onJump, className = '' }: Props) {
  return (
    <nav aria-label="Generations" className={className}>
      <ol className="flex items-center gap-1">
        {generations.map((g, i) => {
          const current = g === active
          const passed = active !== null && g < active
          return (
            <li key={g} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className={`h-px w-2 sm:w-3 ${passed || current ? 'bg-gold' : 'bg-gold/35'}`} />}
              <button
                type="button"
                onClick={() => onJump(g)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Generation ${g}`}
                title={`Generation ${g}`}
                className={`grid h-8 min-w-8 cursor-pointer place-items-center rounded-full border px-1.5 font-display text-[0.875rem] leading-none transition-colors ${
                  current
                    ? 'border-transparent text-paper'
                    : passed
                      ? 'border-gold/70 bg-paper text-gold-ink hover:border-wine hover:text-wine'
                      : 'border-gold/35 bg-paper/70 text-ink-soft hover:border-gold hover:text-wine'
                }`}
                style={current ? { backgroundColor: generationColor(g) } : undefined}
              >
                {toRoman(g)}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
