import { memo } from 'react'
import type { FamilyIndex } from '../lib/family'
import { childrenLabel, membersLabel, toRoman, type Generation } from '../lib/generations'
import { FamilyCluster } from './FamilyCluster'
import type { CardState } from './PersonCard'
import { Patriarch } from './Patriarch'

type Props = {
  generation: Generation
  index: FamilyIndex
  stateOf: (id: number) => CardState
  pulse: number
  selectedId: number | null
  isFirst: boolean
}

function summary({ members, families }: Generation, isFirst: boolean): string {
  if (isFirst && members.length === 1) return 'Where the family line begins'
  const parents = families.filter((f) => f.parent)
  if (families.length === 1 && parents.length === 1) {
    return `${membersLabel(members.length)}, the ${members.length === 1 ? 'child' : 'children'} of ${parents[0].parent!.displayName}`
  }
  return `${membersLabel(members.length)} in ${families.length} families`
}

function GenerationSectionComponent({ generation, index, stateOf, pulse, selectedId, isFirst }: Props) {
  const { number, families, members } = generation
  const numeral = toRoman(number)
  const single = isFirst && members.length === 1 ? members[0] : null

  return (
    <section
      id={`generation-${number}`}
      data-generation={number}
      aria-labelledby={`generation-${number}-title`}
      className="relative overflow-x-clip px-4 pt-10 pb-24 sm:px-8 sm:pb-32"
    >
      {/* the thread that ties this generation to the one above */}
      <div aria-hidden data-descender className="mx-auto flex h-24 w-px origin-top flex-col items-center bg-gradient-to-b from-gold/0 via-gold/70 to-gold sm:h-32">
        <span className="mt-auto size-2.5 translate-y-1 rotate-45 border border-gold bg-ivory" />
      </div>

      <div aria-hidden data-numeral className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 font-display text-[9rem] leading-none text-gold/[0.09] select-none sm:text-[15rem]">
        {numeral}
      </div>

      <header data-heading className="relative mx-auto mt-6 max-w-2xl text-center">
        <h2 id={`generation-${number}-title`} className="font-display text-[2.5rem] leading-tight text-wine sm:text-[3.25rem]">
          Generation {numeral}
        </h2>
        <p className="mt-2 text-[1.0625rem] text-ink-soft">{summary(generation, isFirst)}</p>
      </header>

      <div data-stage className="relative mx-auto mt-14 max-w-[88rem]">
        {single ? (
          <Patriarch
            person={single}
            childCount={index.childrenOf.get(single.id)?.length ?? 0}
            state={stateOf(single.id)}
            pulse={single.id === selectedId ? pulse : 0}
            childrenText={childrenLabel(index.childrenOf.get(single.id)?.length ?? 0)}
          />
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-x-16 gap-y-16">
            {families.map((family) => (
              <FamilyCluster
                key={family.parent?.id ?? 'none'}
                family={family}
                index={index}
                stateOf={stateOf}
                pulse={pulse}
                selectedId={selectedId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export const GenerationSection = memo(GenerationSectionComponent)
