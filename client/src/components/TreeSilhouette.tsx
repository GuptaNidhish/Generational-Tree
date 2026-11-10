import gsap from 'gsap'
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import type { FamilyIndex } from '../lib/family'
import { prefersReducedMotion } from '../lib/motion'
import { generationColor } from '../lib/palette'
import { growTree, TREE_HEIGHT, TREE_WIDTH } from '../lib/treeShape'
import type { Person } from '../types'

type Props = { family: FamilyIndex; persons: Person[]; className?: string }

// A leaf pointing along the branch, drawn at the origin facing right
const LEAF = 'M0 0C4-4.4 10-4.6 15 0C10 4.6 4 4.4 0 0Z'

// The real family as a tree: one branch per parent link, one leaf per person.
// On first load it grows from the trunk outwards, generation by generation.
function TreeSilhouetteComponent({ family, persons, className = '' }: Props) {
  const shape = useMemo(() => growTree(family, persons), [family, persons])
  const ref = useRef<SVGSVGElement>(null)
  const eldest = useMemo(() => Math.min(...persons.map((p) => p.generationNumber)), [persons])
  const generations = useMemo(() => [...new Set(shape.branches.map((b) => b.generation))].sort((a, b) => a - b), [shape])

  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 })
      tl.from('[data-trunk]', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'power2.out' })
      tl.fromTo('[data-roots] path', { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power1.out' }, 0.25)
      generations.forEach((g, i) => {
        const at = 0.55 + i * 0.32
        tl.fromTo(
          `[data-branch-gen="${g}"]`,
          { strokeDasharray: 1, strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 0.55, ease: 'power1.inOut', stagger: { amount: 0.18 } },
          at
        )
        tl.from(`[data-leaf-gen="${g}"]`, { scale: 0, opacity: 0, transformOrigin: 'center', duration: 0.4, ease: 'back.out(2)', stagger: { amount: 0.25 } }, at + 0.35)
      })
      tl.from(`[data-leaf-gen="${eldest}"]`, { scale: 0, opacity: 0, transformOrigin: 'center', duration: 0.4 }, 0.5)
    }, svg)
    return () => ctx.revert()
  }, [generations, eldest])

  return (
    <svg ref={ref} viewBox={`0 0 ${TREE_WIDTH} ${TREE_HEIGHT + 20}`} preserveAspectRatio="xMidYMax meet" aria-hidden className={className}>
      <g data-roots fill="none" stroke="var(--color-wine-deep)" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round">
        {shape.roots.map((d) => (
          <path key={d} d={d} pathLength={1} />
        ))}
      </g>
      <path data-trunk d={shape.trunk} fill="var(--color-wine-deep)" fillOpacity={0.88} />
      <g fill="none" stroke="var(--color-wine-deep)" strokeLinecap="round">
        {shape.branches.map((b) => (
          <path
            key={b.id}
            data-branch-gen={b.generation}
            d={b.d}
            pathLength={1}
            strokeWidth={b.width}
            strokeOpacity={Math.max(0.42, 0.9 - (b.generation - 2) * 0.09)}
          />
        ))}
      </g>
      <g>
        {shape.leaves.map((l) =>
          l.hasChildren ? (
            <circle key={l.id} data-leaf-gen={l.generation} cx={l.x} cy={l.y} r={l.generation === 1 ? 6 : 3.4} fill="var(--color-gold)" stroke="var(--color-ivory)" strokeWidth={1.2} />
          ) : (
            <g key={l.id} transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}>
              <path data-leaf-gen={l.generation} d={LEAF} fill={generationColor(l.generation)} fillOpacity={0.9} />
            </g>
          )
        )}
      </g>
    </svg>
  )
}

export const TreeSilhouette = memo(TreeSilhouetteComponent)
