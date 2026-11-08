import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { hoverLift, hoverReset, riseCard, selectPulse, stampCard } from '../lib/animations'
import { NODE_HEIGHT, NODE_WIDTH, type PersonNode as PersonNodeType } from '../lib/layout'
import { prefersReducedMotion } from '../lib/motion'
import { generationColor } from '../lib/palette'
import { GenderMark } from './GenderMark'
import { useTreeActions } from './treeActions'

const STATE_CLASSES = {
  normal: 'border-ink/15 bg-paper hover:border-ink/35 hover:shadow-md',
  selected: 'border-haldi-deep bg-haldi-wash ring-2 ring-haldi shadow-lg',
  lineage: 'border-haldi-deep bg-paper ring-1 ring-haldi/60 shadow-md',
  dimmed: 'border-ink/10 bg-paper opacity-25',
}

function PersonNodeComponent({ data }: NodeProps<PersonNodeType>) {
  const { person, state = 'normal', reveal } = data
  const { select } = useTreeActions()
  const color = generationColor(person.generationNumber)

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLButtonElement>(null)
  const animatedRef = useRef(false)

  // GSAP Entrance Reveal
  useEffect(() => {
    if (prefersReducedMotion() || animatedRef.current) return
    if (!containerRef.current) return

    if (typeof reveal === 'number') {
      animatedRef.current = true
      const delaySec = reveal / 1000
      if (person.generationNumber === 1) {
        stampCard(containerRef.current, delaySec)
      } else {
        riseCard(containerRef.current, delaySec)
      }
    }
  }, [reveal, person.generationNumber])

  // GSAP Pulse on Selection
  useEffect(() => {
    if (state === 'selected' && cardRef.current && !prefersReducedMotion()) {
      selectPulse(cardRef.current)
    }
  }, [state])

  const handlePointerEnter = useCallback(() => {
    if (cardRef.current && (state === 'normal' || state === 'lineage')) {
      hoverLift(cardRef.current)
    }
  }, [state])

  const handlePointerLeave = useCallback(() => {
    if (cardRef.current) {
      hoverReset(cardRef.current)
    }
  }, [])

  const handleClick = useCallback(() => {
    if (cardRef.current && !prefersReducedMotion()) {
      selectPulse(cardRef.current)
    }
    select(person.id)
  }, [person.id, select])

  // Hide initially if waiting for reveal delay
  const isHidden = reveal === 'hidden'
  const styleObj: React.CSSProperties = isHidden ? { opacity: 0, pointerEvents: 'none' } : {}

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div ref={containerRef} style={styleObj}>
        <button
          ref={cardRef}
          type="button"
          tabIndex={isHidden ? -1 : undefined}
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          aria-pressed={state === 'selected'}
          style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
          className={`group flex cursor-pointer select-none items-stretch overflow-hidden rounded-lg border text-left transition-[opacity,background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-haldi focus:outline-none ${STATE_CLASSES[state]}`}
        >
          <span
            aria-hidden
            className="w-1.5 shrink-0 transition-all duration-200 group-hover:w-2"
            style={{ backgroundColor: color }}
          />
          <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
            <span className="line-clamp-2 text-[14px] leading-[1.2] font-semibold text-ink group-hover:text-bahi-deep">
              {person.displayName}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <span
                style={{ color }}
                className="inline-flex items-center rounded-sm px-1 py-0.5 text-[11px] font-bold tracking-wide"
              >
                Gen {person.generationNumber}
              </span>
              <GenderMark gender={person.gender} className="text-[13px] leading-none" />
            </span>
          </span>
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  )
}

export const PersonNode = memo(PersonNodeComponent)
