import { honorific } from '../lib/generations'
import type { Person } from '../types'
import type { CardState } from './PersonCard'
import { useStoryActions } from './storyActions'

type Props = { person: Person; childCount: number; childrenText: string; state: CardState; pulse: number }

// The eldest ancestor, given a framed plate of their own
export function Patriarch({ person, childCount, childrenText, state, pulse }: Props) {
  const { open, goToChildren } = useStoryActions()
  const g = person.gender.toLowerCase()
  const pronoun = g === 'male' ? 'his' : g === 'female' ? 'her' : 'the'

  return (
    <div data-family="root" className="flex justify-center">
      <div data-card className="w-full max-w-md">
        <article
          data-person-id={person.id}
          data-state={state}
          className="person-card patriarch-frame relative rounded-2xl px-8 pt-9 pb-8 text-center"
        >
          {state === 'selected' && (
            <span key={pulse} aria-hidden className="select-ring pointer-events-none absolute -inset-1.5 rounded-[18px] border-2 border-gold" />
          )}
          {/* corner ornaments */}
          {['top-3 left-3', 'top-3 right-3 rotate-90', 'bottom-3 right-3 rotate-180', 'bottom-3 left-3 -rotate-90'].map((pos) => (
            <svg key={pos} aria-hidden viewBox="0 0 24 24" className={`absolute size-6 text-gold ${pos}`} fill="none" stroke="currentColor" strokeWidth={1.25}>
              <path d="M2 14V2h12M2 8c3 0 6-3 6-6M6 2a4 4 0 0 1-4 4" />
            </svg>
          ))}

          <p className="text-[0.9375rem] text-gold-ink">The eldest recorded ancestor</p>
          <h3 className="mt-2 font-display text-[2rem] leading-tight text-wine sm:text-[2.4rem]">
            <button
              type="button"
              onClick={() => open(person.id)}
              aria-pressed={state === 'selected'}
              className="cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-gold"
            >
              {honorific(person)}
            </button>
          </h3>

          <div aria-hidden className="mx-auto my-5 flex w-40 items-center gap-2 text-gold">
            <span className="h-px flex-1 bg-current" />
            <span className="size-1.5 rotate-45 bg-current" />
            <span className="h-px flex-1 bg-current" />
          </div>

          {childCount > 0 && (
            <button
              type="button"
              onClick={() => goToChildren(person.id)}
              className="relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-full border border-gold/50 px-4 py-1.5 text-[0.9375rem] font-medium text-gold-ink transition-colors hover:border-gold hover:bg-gold/10 hover:text-wine"
            >
              Meet {pronoun} {childrenText}
              <svg aria-hidden className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </article>
      </div>
    </div>
  )
}
