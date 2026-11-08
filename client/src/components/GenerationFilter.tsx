import { useCallback, useRef } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { generationColor } from '../lib/palette'
import gsap from 'gsap'

type Props = {
  generations: number[]
  selected: Set<number>
  onChange: (selected: Set<number>) => void
}

export function GenerationFilter({ generations, selected, onChange }: Props) {
  const chipsRef = useRef<Map<number, HTMLButtonElement>>(new Map())

  const toggle = useCallback(
    (generation: number) => {
      const btn = chipsRef.current.get(generation)
      if (btn && !prefersReducedMotion()) {
        gsap.fromTo(
          btn,
          { scale: 0.92 },
          { scale: 1, duration: 0.25, ease: 'back.out(2)' }
        )
      }

      const next = new Set(selected)
      if (next.has(generation)) next.delete(generation)
      else next.add(generation)
      onChange(next)
    },
    [selected, onChange]
  )

  const clearAll = useCallback(() => {
    onChange(new Set())
  }, [onChange])

  return (
    <div
      role="group"
      aria-label="Filter by generation"
      className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none"
    >
      <span className="shrink-0 text-xs font-semibold tracking-wider text-kora/75 uppercase sm:text-sm">
        Generations:
      </span>

      <div className="flex items-center gap-1.5">
        {generations.map((g) => {
          const on = selected.has(g)
          const color = generationColor(g)
          return (
            <button
              key={g}
              ref={(el) => {
                if (el) chipsRef.current.set(g, el)
                else chipsRef.current.delete(g)
              }}
              type="button"
              aria-pressed={on}
              aria-label={`Generation ${g}`}
              onClick={() => toggle(g)}
              className={`group relative flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-all sm:text-sm ${
                on
                  ? 'border-2 border-haldi bg-haldi text-ink shadow-sm'
                  : 'border border-kora/30 bg-black/10 text-kora hover:border-kora/70 hover:bg-black/20'
              }`}
            >
              <span
                aria-hidden
                className="size-2 rounded-full transition-transform group-hover:scale-125"
                style={{ backgroundColor: color }}
              />
              <span>{g}</span>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-2 shrink-0 cursor-pointer rounded-full border border-kora/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-kora transition-colors hover:bg-white/20"
        >
          Reset ({selected.size} active)
        </button>
      )}
    </div>
  )
}
