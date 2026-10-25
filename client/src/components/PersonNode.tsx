import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { NODE_HEIGHT, NODE_WIDTH, type PersonNode as PersonNodeType } from '../lib/layout'
import { generationColor } from '../lib/palette'
import { GenderMark } from './GenderMark'
import { useTreeActions } from './treeActions'

const STATE_CLASSES = {
  normal: 'border-ink/15 bg-paper',
  selected: 'border-haldi-deep bg-haldi-wash ring-2 ring-haldi',
  lineage: 'border-haldi-deep bg-paper',
  dimmed: 'border-ink/10 bg-paper opacity-25',
}

function PersonNodeComponent({ data }: NodeProps<PersonNodeType>) {
  const { person, state = 'normal' } = data
  const { select } = useTreeActions()
  const color = generationColor(person.generationNumber)

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <button
        type="button"
        onClick={() => select(person.id)}
        aria-pressed={state === 'selected'}
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
        className={`flex cursor-pointer items-stretch overflow-hidden rounded-md border text-left transition-[opacity,background-color] duration-200 motion-reduce:transition-none ${STATE_CLASSES[state]}`}
      >
        <span aria-hidden className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
          <span className="line-clamp-3 text-[14px] leading-[1.15] font-semibold text-ink">{person.displayName}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <span style={{ color }} className="font-semibold">
              Gen {person.generationNumber}
            </span>
            <GenderMark gender={person.gender} className="text-[13px] leading-none" />
          </span>
        </span>
      </button>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  )
}

export const PersonNode = memo(PersonNodeComponent)
