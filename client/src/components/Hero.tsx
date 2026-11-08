import { useEffect, useRef } from 'react'
import { countUp } from '../lib/animations'
import type { FamilyIndex } from '../lib/family'
import { honorific } from '../lib/generations'
import type { Person } from '../types'
import { TreeSilhouette } from './TreeSilhouette'

type Props = {
  family: FamilyIndex
  persons: Person[]
  root: Person | undefined
  generationCount: number
  onBegin: () => void
}

export function Hero({ family, persons, root, generationCount, onBegin }: Props) {
  const peopleRef = useRef<HTMLElement>(null)
  const gensRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (peopleRef.current) countUp(peopleRef.current, persons.length, 1.8, 1.2)
    if (gensRef.current) countUp(gensRef.current, generationCount, 1.2, 1.2)
  }, [persons.length, generationCount])

  return (
    <section data-hero aria-labelledby="site-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden px-5 pt-24 sm:px-8 lg:pt-20">
      <div aria-hidden className="jaali absolute inset-0 -z-10 opacity-[0.09] [mask-image:radial-gradient(ellipse_at_60%_45%,black_10%,transparent_70%)]" />

      <div className="mx-auto grid w-full max-w-[88rem] flex-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10">
        <div data-hero-text className="relative z-10 text-center lg:text-left">
          <p lang="hi" className="font-display text-[1.375rem] text-gold-ink sm:text-[1.625rem]">
            गुप्ता वंशावली
          </p>
          <h1 id="site-title" className="mt-1 font-display text-[clamp(3rem,10vw,5.6rem)] leading-[0.98] text-wine lg:text-[clamp(3rem,6vw,5.6rem)]">
            Gupta Vanshavali
          </h1>
          <p className="mt-5 text-[1.25rem] text-ink sm:text-[1.5rem]">The Legacy of Generations</p>
          {root && <p className="mt-1 text-[1.0625rem] text-ink-soft sm:text-[1.1875rem]">Descendants of {honorific(root)}</p>}

          <dl className="mt-8 inline-flex items-end gap-8 sm:gap-12">
            <div className="flex flex-col-reverse items-center lg:items-start">
              <dt className="mt-1 text-[0.9375rem] text-ink-soft">family members</dt>
              <dd className="font-display text-[2.5rem] leading-none text-wine sm:text-[3rem]">
                <span ref={peopleRef}>{persons.length}</span>
              </dd>
            </div>
            <div className="flex flex-col-reverse items-center border-l border-gold/50 pl-8 sm:pl-12 lg:items-start">
              <dt className="mt-1 text-[0.9375rem] text-ink-soft">generations</dt>
              <dd className="font-display text-[2.5rem] leading-none text-wine sm:text-[3rem]">
                <span ref={gensRef}>{generationCount}</span>
              </dd>
            </div>
          </dl>
        </div>

        <figure data-hero-tree className="relative m-0 flex h-[min(85vw,34rem)] min-h-[15rem] flex-col lg:h-[min(70svh,40rem)]">
          <TreeSilhouette family={family} persons={persons} className="h-full w-full flex-1" />
          <figcaption className="mt-2 text-center text-[0.9375rem] text-ink-soft">Each leaf is one member of the family, placed on the branch they descend from.</figcaption>
        </figure>
      </div>

      <div data-hero-foot className="relative z-10 flex justify-center pt-4 pb-6">
        <button
          type="button"
          onClick={onBegin}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg px-3 py-1 text-[0.9375rem] font-medium text-gold-ink hover:text-wine"
        >
          Scroll to begin with the first generation
          <span aria-hidden className="relative h-12 w-px bg-gold/40">
            <span className="scroll-bead absolute top-0 -left-[3px] size-[7px] rounded-full bg-gold" />
          </span>
        </button>
      </div>
    </section>
  )
}
