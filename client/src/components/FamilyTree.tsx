import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useGlideScroll } from '../hooks/useGlideScroll'
import { useReveal } from '../hooks/useReveal'
import { NODE_HEIGHT, NODE_WIDTH, RANK_GAP, rankY, type NodeState, type PersonNode as PersonNodeType } from '../lib/layout'
import { prefersReducedMotion } from '../lib/motion'
import { generationColor } from '../lib/palette'
import { BAND_GUTTER, BandNode, type BandNodeType } from './BandNode'
import { DrawInEdge, type DrawInEdgeType } from './DrawInEdge'
import { GenerationRail } from './GenerationRail'
import { PersonNode } from './PersonNode'

const nodeTypes = { person: PersonNode, band: BandNode }
const edgeTypes = { drawIn: DrawInEdge }

const OPENING_ZOOM = 0.8
const OPENING_TOP = 0.28 // where the root sits, as a share of the canvas height
const EDGE_LEAD_MS = 220 // a card rises once the line from its parent is partly drawn
const TRACE_STEP_MS = 110 // per-generation delay when tracing a selected bloodline


type Props = {
  layout: { nodes: PersonNodeType[]; edges: Edge[] }
  lineage: Set<number> | null
  selectedId: number | null
  selectedGenerations: Set<number>
  onPaneClick: () => void
  onExplore: () => void
}

type Highlight = Pick<Props, 'lineage' | 'selectedId' | 'selectedGenerations'>

function stateFor(id: number, generation: number, { lineage, selectedId, selectedGenerations }: Highlight): NodeState {
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
  const generations = new Set(nodes.map((n) => n.data.person.generationNumber))

  return [...generations].map((generation) => ({
    id: `band-${generation}`,
    type: 'band',
    position: { x: left, y: rankY(generation) - RANK_GAP / 2 },
    data: { generation, width, height: NODE_HEIGHT + RANK_GAP },
    zIndex: -1,
    draggable: false,
    selectable: false,
    focusable: false,
  }))
}

export function FamilyTree({ layout, lineage, selectedId, selectedGenerations, onPaneClick, onExplore }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const { setCenter } = useReactFlow()
  const [ready, setReady] = useState(false)
  const animate = useMemo(() => !prefersReducedMotion(), [])

  useGlideScroll(container, onExplore)
  const revealed = useReveal(layout.nodes, layout.edges, ready && animate)

  const bands = useMemo(() => buildBands(layout.nodes), [layout.nodes])
  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const n of layout.nodes) map.set(n.data.person.generationNumber, (map.get(n.data.person.generationNumber) ?? 0) + 1)
    return new Map([...map].sort(([a], [b]) => a - b))
  }, [layout.nodes])
  const hasParent = useMemo(() => new Set(layout.edges.map((e) => e.target)), [layout.edges])

  const nodes = useMemo<Node[]>(() => {
    const people = layout.nodes.map((n) => {
      const delay = revealed?.cards.get(n.id)
      const reveal =
        !revealed || revealed.settledCards.has(n.id)
          ? undefined
          : delay === undefined
            ? ('hidden' as const)
            : delay + (hasParent.has(n.id) ? EDGE_LEAD_MS : 0)
      return {
        ...n,
        data: { ...n.data, reveal, state: stateFor(n.data.person.id, n.data.person.generationNumber, { lineage, selectedId, selectedGenerations }) },
      }
    })
    return [...bands, ...people]
  }, [bands, layout.nodes, revealed, hasParent, lineage, selectedId, selectedGenerations])

  const edges = useMemo<DrawInEdgeType[]>(() => {
    const genOf = new Map(layout.nodes.map((n) => [n.id, n.data.person.generationNumber]))
    const topGeneration = Math.min(...genOf.values())

    const lineData = (e: Edge, inLineage: boolean): DrawInEdgeType['data'] => {
      if (revealed && !revealed.settledLines.has(e.id)) {
        const delay = revealed.lines.get(e.id)
        return delay === undefined ? { mode: 'hidden' } : { mode: 'draw', delay }
      }
      // a selected bloodline draws itself in, eldest generation first
      if (inLineage && animate) return { mode: 'trace', delay: (genOf.get(e.source)! - topGeneration) * TRACE_STEP_MS }
      return {}
    }

    return layout.edges.map((e) => {
      let className = ''
      if (lineage) className = lineage.has(Number(e.source)) && lineage.has(Number(e.target)) ? 'lineage' : 'dimmed'
      else if (selectedGenerations.size > 0 && !selectedGenerations.has(genOf.get(e.target)!)) className = 'dimmed'
      return {
        ...e,
        type: 'drawIn',
        className,
        zIndex: className === 'lineage' ? 1 : 0,
        data: lineData(e, className === 'lineage'),
      }
    })
  }, [layout, lineage, selectedGenerations, revealed, animate])


  // Opening shot: the root, readable, in the upper part of the canvas
  const onInit = useCallback(() => {
    const roots = layout.nodes.filter((n) => !hasParent.has(n.id))
    const root = roots[0] ?? layout.nodes[0]
    const height = container.current?.clientHeight ?? 800
    if (root) {
      setCenter(
        root.position.x + NODE_WIDTH / 2,
        root.position.y + NODE_HEIGHT / 2 + (height * (0.5 - OPENING_TOP)) / OPENING_ZOOM,
        { zoom: OPENING_ZOOM, duration: 0 }
      )
    }
    setReady(true)
  }, [layout.nodes, hasParent, setCenter])

  return (
    <div ref={container} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        onPaneClick={onPaneClick}
        onMoveStart={(event) => event && onExplore()}
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={['Meta', 'Control']}
        zoomOnDoubleClick={false}
        minZoom={0.05}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgb(31 35 71 / 0.08)" />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          className="!hidden sm:!block"
          nodeColor={(n) => (n.type === 'person' ? generationColor((n as PersonNodeType).data.person.generationNumber) : 'transparent')}
          nodeStrokeWidth={0}
          ariaLabel="Overview of the whole tree"
        />
      </ReactFlow>
      <GenerationRail counts={counts} />
    </div>
  )
}
