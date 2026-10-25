import { getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

const BRACKET_PX = 26

// hidden: not revealed yet · draw: first reveal · trace: drawn as part of a
// selected bloodline · absent: static
export type DrawInEdgeData = { mode?: 'hidden' | 'draw' | 'trace'; delay?: number }
export type DrawInEdgeType = Edge<DrawInEdgeData, 'drawIn'>

// Smooth-step parent→child line that can draw itself in
function DrawInEdgeComponent({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<DrawInEdgeType>) {
  // branch just above the children (a sibling bracket), clear of the ledger rule between rows
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, centerY: targetY - BRACKET_PX })
  const mode = data?.mode
  return (
    <path
      d={path}
      pathLength={1}
      fill="none"
      className={`react-flow__edge-path ${mode ? `edge-${mode}` : ''}`}
      style={mode === 'draw' || mode === 'trace' ? { animationDelay: `${data?.delay ?? 0}ms` } : undefined}
    />
  )
}

export const DrawInEdge = memo(DrawInEdgeComponent)
