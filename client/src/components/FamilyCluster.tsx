import { memo } from 'react'
import type { FamilyIndex } from '../lib/family'
import { toRoman } from '../lib/generations'
import type { Family } from '../lib/generations'
import { BranchConnectors } from './BranchConnectors'
import { PersonCard, type CardState } from './PersonCard'
import { useStoryActions } from './storyActions'

type Props = {
  family: Family
  index: FamilyIndex
  stateOf: (id: number) => CardState
  pulse: number
  selectedId: number | null
}

const cols = (n: number) =>
  ({
    '--cols-sm': Math.min(n, 2),
    '--cols-md': Math.min(n, 3),
    '--cols-lg': Math.min(n, 4),
  }) as React.CSSProperties

// One sibling group under the parent they descend from
function FamilyClusterComponent({ family, index, stateOf, pulse, selectedId }: Props) {
  const { goToPerson } = useStoryActions()
  const { parent, children } = family

  return (
    <div data-family={parent?.id ?? 'none'} className="w-full max-w-full sm:w-auto">
      {parent && (
        <button
          type="button"
          data-family-label
          onClick={() => goToPerson(parent.id)}
          title={`Go to ${parent.displayName} in generation ${parent.generationNumber}`}
          className="group inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border border-gold/40 bg-paper/80 py-1 pr-3.5 pl-1.5 text-left text-[0.9375rem] text-ink-soft transition-colors hover:border-gold hover:text-ink"
        >
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-ink group-hover:bg-gold/25">
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.83l-3.71 3.94a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="truncate">
            Children of <span className="font-semibold text-ink">{parent.displayName}</span>
            <span className="sr-only">, generation {parent.generationNumber}</span>
          </span>
          <span aria-hidden className="font-display text-sm text-gold-ink">
            {toRoman(parent.generationNumber)}
          </span>
        </button>
      )}

      <div className={`relative ${parent ? 'pt-7 pl-7' : 'pt-2'}`}>
        {parent && <BranchConnectors />}
        <div className="family-grid" style={cols(children.length)}>
          {children.map((child) => (
            <div key={child.id} data-card className="h-full">
              <PersonCard
                person={child}
                childCount={index.childrenOf.get(child.id)?.length ?? 0}
                state={stateOf(child.id)}
                pulse={child.id === selectedId ? pulse : 0}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const FamilyCluster = memo(FamilyClusterComponent)
