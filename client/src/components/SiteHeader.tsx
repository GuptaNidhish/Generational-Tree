import type { RefObject } from 'react'
import type { Person } from '../types'
import { GenerationNav } from './GenerationNav'
import { SearchBox } from './SearchBox'

type Props = {
  persons: Person[]
  generations: number[]
  active: number | null
  pastHero: boolean
  progressRef: RefObject<HTMLDivElement | null>
  onJump: (generation: number) => void
  onFind: (person: Person) => void
  describe: (person: Person) => string | null
  onHome: () => void
}

export function SiteHeader({ persons, generations, active, pastHero, progressRef, onJump, onFind, describe, onHome }: Props) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-[background-color,box-shadow] duration-300 ${
        pastHero ? 'bg-ivory/95 shadow-[0_1px_0_rgb(168_131_63_/_0.35),0_8px_24px_-18px_rgb(74_14_26_/_0.5)] backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[88rem] items-center gap-3 px-4 sm:gap-6 sm:px-8">
        <button
          type="button"
          onClick={onHome}
          className={`shrink-0 cursor-pointer font-display text-[1.25rem] leading-none text-wine transition-opacity duration-300 sm:text-[1.5rem] ${
            pastHero ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          tabIndex={pastHero ? 0 : -1}
          aria-hidden={!pastHero}
        >
          Gupta Vanshavali
        </button>

        <GenerationNav
          generations={generations}
          active={active}
          onJump={onJump}
          className={`mx-auto hidden transition-opacity duration-300 lg:block ${pastHero ? 'opacity-100' : 'opacity-0 focus-within:opacity-100'}`}
        />

        <div className="ml-auto min-w-0 flex-1 sm:max-w-80 lg:ml-0 lg:w-80 lg:flex-none">
          <SearchBox persons={persons} onSelect={onFind} describe={describe} />
        </div>
      </div>
      {/* reading progress through the whole family */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
        <div ref={progressRef} className="h-full origin-left scale-x-0 bg-gold" />
      </div>
    </header>
  )
}
