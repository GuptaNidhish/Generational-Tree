import gsap from 'gsap'
import { memo, useRef } from 'react'
import { childrenLabel, childWord, toRoman } from '../lib/generations'
import { canTilt } from '../lib/motion'
import { generationColor } from '../lib/palette'
import type { Person } from '../types'
import { GenderMark } from './GenderMark'
import { useStoryActions } from './storyActions'

export type CardState = 'normal' | 'selected' | 'relative'

type Props = {
  person: Person
  childCount: number
  state: CardState
  // changes on every new selection of this card, to replay the ring
  pulse: number
}

function PersonCardComponent({ person, childCount, state, pulse }: Props) {
  const { open, goToChildren } = useStoryActions()
  const ref = useRef<HTMLElement>(null)
  const tilt = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null>(null)
  const color = generationColor(person.generationNumber)
  const relation = childWord(person.gender)

  // A light tilt towards the pointer, with a soft highlight following it
  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || !canTilt()) return
    if (!tilt.current) gsap.set(el, { transformPerspective: 700 })
    tilt.current ??= {
      x: gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3.out' }),
    }
    const box = el.getBoundingClientRect()
    const px = (e.clientX - box.left) / box.width
    const py = (e.clientY - box.top) / box.height
    tilt.current.x((0.5 - py) * 8)
    tilt.current.y((px - 0.5) * 10)
    el.style.setProperty('--glow-x', `${px * 100}%`)
    el.style.setProperty('--glow-y', `${py * 100}%`)
  }

  function onPointerLeave() {
    tilt.current?.x(0)
    tilt.current?.y(0)
  }

  return (
    <article
      ref={ref}
      data-person-id={person.id}
      data-state={state}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="person-card group relative flex h-full min-h-[5rem] flex-col sm:min-h-[6.5rem] rounded-[10px] border border-gold/35 py-3.5 pr-4 pl-5"
    >
      {state === 'selected' && (
        <span key={pulse} aria-hidden className="select-ring pointer-events-none absolute -inset-1 rounded-[13px] border-2 border-gold" />
      )}
      <span aria-hidden className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full" style={{ backgroundColor: color }} />

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.0625rem] leading-snug font-semibold text-ink">
          {/* the whole card opens the profile */}
          <button
            type="button"
            onClick={() => open(person.id)}
            aria-pressed={state === 'selected'}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-[10px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-gold group-hover:text-wine"
          >
            {person.displayName}
          </button>
        </h3>
        <span className="mt-0.5 font-display text-[0.95rem] leading-none" style={{ color }} title={`Generation ${person.generationNumber}`}>
          <span className="sr-only">Generation </span>
          {toRoman(person.generationNumber)}
        </span>
      </div>

      {relation && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-ink-soft">
          <GenderMark gender={person.gender} className="text-[0.8rem] text-gold-ink" />
          {relation}
        </p>
      )}

      {childCount > 0 && (
        <button
          type="button"
          onClick={() => goToChildren(person.id)}
          aria-label={`Show the ${childrenLabel(childCount)} of ${person.displayName}`}
          className="relative z-10 mt-auto inline-flex w-fit cursor-pointer items-center gap-1 self-start rounded-full pt-3 text-[0.9375rem] font-medium text-gold-ink transition-colors hover:text-wine"
        >
          {childrenLabel(childCount)}
          <svg aria-hidden className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </article>
  )
}

export const PersonCard = memo(PersonCardComponent)
