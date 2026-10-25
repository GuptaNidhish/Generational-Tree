import { useStore } from '@xyflow/react'
import { NODE_HEIGHT, rankY } from '../lib/layout'
import { generationColor } from '../lib/palette'

type Props = { counts: Map<number, number> }

// Generation labels pinned to the left edge, following the camera vertically
export function GenerationRail({ counts }: Props) {
  const [, ty, zoom] = useStore((s) => s.transform)
  const height = useStore((s) => s.height)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-36 overflow-hidden">
      {[...counts].map(([generation, count]) => {
        const center = (rankY(generation) + NODE_HEIGHT / 2) * zoom + ty
        if (center < -40 || center > height + 40) return null
        return (
          <div
            key={generation}
            className="absolute left-0 -translate-y-1/2 rounded-r-md border-y border-r border-ink/10 bg-paper/90 py-1 pr-3 pl-3 backdrop-blur-sm"
            style={{ top: center, borderLeft: `4px solid ${generationColor(generation)}` }}
          >
            <div className="text-sm leading-tight font-semibold" style={{ color: generationColor(generation) }}>
              <span className="sm:hidden">Gen {generation}</span>
              <span className="hidden sm:inline">Generation {generation}</span>
            </div>
            <div className="hidden text-xs text-ink-soft sm:block">
              {count} {count === 1 ? 'person' : 'people'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
