import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { useMemo } from 'react'
import { NODE_HEIGHT, NODE_WIDTH, RANK_GAP, rankY, type NodeState, type PersonNode as PersonNodeType } from '../lib/layout'
import { generationColor } from '../lib/palette'
import { BAND_GUTTER, BandNode, type BandNodeType } from './BandNode'
import { PersonNode } from './PersonNode'

const nodeTypes = { person: PersonNode, band: BandNode }

type Props = {
  layout: { nodes: PersonNodeType[]; edges: Edge[] }
  lineage: Set<number> | null
  selectedId: number | null
  selectedGenerations: Set<number>
  onPaneClick: () => void
}

function stateFor(id: number, generation: number, { lineage, selectedId, selectedGenerations }: Omit<Props, 'layout' | 'onPaneClick'>): NodeState {
  if (id === selectedId) return 'selected'
  if (lineage) return lineage.has(id) ? 'lineage' : 'dimmed'
  if (selectedGenerations.size > 0 && !selectedGenerations.has(generation)) return 'dimmed'
  return 'normal'
}

// One ruled background row per generation, spanning the whole tree
function buildBands(nodes: PersonNodeType[]): BandNodeType[] {
  const xs = nodes.map((n) => n.position.x)
  const left = Math.min(...xs) - BAND_GUTTER - 48
  const width = Math.max(...xs) + NODE_WIDTH + 48 - left
  const counts = new Map<number, number>()
  for (const n of nodes) counts.set(n.data.person.generationNumber, (counts.get(n.data.person.generationNumber) ?? 0) + 1)

  return [...counts].map(([generation, count]) => ({
    id: `band-${generation}`,
    type: 'band',
    position: { x: left, y: rankY(generation) - RANK_GAP / 2 },
    data: { generation, count, width, height: NODE_HEIGHT + RANK_GAP },
    zIndex: -1,
    draggable: false,
    selectable: false,
    focusable: false,
  }))
}

export function FamilyTree({ layout, lineage, selectedId, selectedGenerations, onPaneClick }: Props) {
  const bands = useMemo(() => buildBands(layout.nodes), [layout.nodes])

  const nodes = useMemo<Node[]>(() => {
    const people = layout.nodes.map((n) => ({
      ...n,
      data: { ...n.data, state: stateFor(n.data.person.id, n.data.person.generationNumber, { lineage, selectedId, selectedGenerations }) },
    }))
    return [...bands, ...people]
  }, [bands, layout.nodes, lineage, selectedId, selectedGenerations])

  const edges = useMemo<Edge[]>(() => {
    const genOf = new Map(layout.nodes.map((n) => [n.id, n.data.person.generationNumber]))
    return layout.edges.map((e) => {
      let className = ''
      if (lineage) className = lineage.has(Number(e.source)) && lineage.has(Number(e.target)) ? 'lineage' : 'dimmed'
      else if (selectedGenerations.size > 0 && !selectedGenerations.has(genOf.get(e.target)!)) className = 'dimmed'
      return { ...e, className, zIndex: className === 'lineage' ? 1 : 0 }
    })
  }, [layout, lineage, selectedGenerations])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.04 }}
      minZoom={0.05}
      maxZoom={2}
      onlyRenderVisibleElements
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgb(31 35 71 / 0.08)" />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        className="!hidden sm:!block"
        nodeColor={(n) => (n.type === 'person' ? generationColor((n as PersonNodeType).data.person.generationNumber) : 'transparent')}
        nodeStrokeWidth={0}
        ariaLabel="Overview of the whole tree"
      />
    </ReactFlow>
  )
}
