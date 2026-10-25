import type { Node, NodeProps } from '@xyflow/react'
import { memo } from 'react'

export type BandNodeData = { generation: number; width: number; height: number }
export type BandNodeType = Node<BandNodeData, 'band'>

export const BAND_GUTTER = 150

// One ruled ledger row per generation (labels live in GenerationRail)
function BandNodeComponent({ data }: NodeProps<BandNodeType>) {
  const { generation, width, height } = data
  return (
    <div
      style={{ width, height }}
      className={`relative border-t border-ink/10 ${generation % 2 === 0 ? 'bg-ink/[0.025]' : ''}`}
    >
      <div
        className="absolute top-0 bottom-0 border-r border-bahi/25"
        style={{ width: BAND_GUTTER }}
      />
    </div>
  )
}

export const BandNode = memo(BandNodeComponent)
