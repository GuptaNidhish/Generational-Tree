import { useLayoutEffect, useRef, useState } from 'react'

// x of the trunk that drops from the parent label down the left gutter
export const TRUNK_X = 10
const BUS_GAP = 16 // the horizontal branch runs this far above each row of cards

// Elbow branches from the parent label to every child card, measured from the
// real layout so they stay correct however the cards wrap: a trunk down the
// gutter, a horizontal branch above each row, and a drop to each card.
// The SVG's parent must be the positioned element that contains the cards.
export function BranchConnectors() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [d, setD] = useState('')
  const [knots, setKnots] = useState<{ x: number; y: number }[]>([])
  const frame = useRef(0)

  useLayoutEffect(() => {
    const body = svgRef.current?.parentElement
    if (!body) return

    const measure = () => {
      const cards = [...body.querySelectorAll<HTMLElement>('[data-card]')]
      const rows = new Map<number, number[]>()
      for (const card of cards) {
        const top = card.offsetTop
        const cx = card.offsetLeft + card.offsetWidth / 2
        const row = rows.get(top)
        if (row) row.push(cx)
        else rows.set(top, [cx])
      }
      const parts: string[] = []
      const points: { x: number; y: number }[] = []
      let lastBus = 0
      for (const [top, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
        const bus = top - BUS_GAP
        lastBus = bus
        parts.push(`M${TRUNK_X} ${bus}H${Math.max(...xs)}`)
        for (const x of xs) {
          parts.push(`M${x} ${bus}V${top}`)
          points.push({ x, y: top })
        }
      }
      if (rows.size) parts.unshift(`M${TRUNK_X} 0V${lastBus}`)
      setD(parts.join(''))
      setKnots(points)
    }

    measure()
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(measure)
    })
    observer.observe(body)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [])

  return (
    <svg ref={svgRef} data-connectors aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <path d={d} fill="none" stroke="var(--color-gold)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {knots.map(({ x, y }) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={2.75} fill="var(--color-gold)" />
      ))}
    </svg>
  )
}
