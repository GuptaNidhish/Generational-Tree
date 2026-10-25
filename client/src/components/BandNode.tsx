import type { Node, NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { generationColor } from '../lib/palette'

export type BandNodeData = { generation: number; count: number; width: number; height: number }
export type BandNodeType = Node<BandNodeData, 'band'>

export const BAND_GUTTER = 150

// One ruled ledger row per generation, labelled in the left gutter
function BandNodeComponent({ data }: NodeProps<BandNodeType>) {
  const { generation, count, width, height } = data
  const color = generationColor(generation)
  return (
    <div
      style={{ width, height }}
      className={`relative border-t border-ink/10 ${generation % 2 === 0 ? 'bg-ink/[0.025]' : ''}`}
    >
      <div
        className="absolute top-0 bottom-0 border-r border-bahi/25"
        style={{ width: BAND_GUTTER }}
      />
      <div className="absolute top-1/2 left-5 -translate-y-1/2">
        <div className="text-lg font-semibold leading-tight" style={{ color }}>
          Generation {generation}
        </div>
        <div className="text-sm text-ink-soft">
          {count} {count === 1 ? 'person' : 'people'}
        </div>
      </div>
    </div>
  )
}

export const BandNode = memo(BandNodeComponent)
