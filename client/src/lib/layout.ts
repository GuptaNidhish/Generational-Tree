import type { Edge, Node } from '@xyflow/react'
import { hierarchy, tree } from 'd3-hierarchy'
import type { Person, TreeData } from '../types'

export const NODE_WIDTH = 140
export const NODE_HEIGHT = 84
export const RANK_GAP = 88
const SIBLING_GAP = 14

export type NodeState = 'normal' | 'selected' | 'lineage' | 'dimmed'
export type PersonNodeData = { person: Person; state?: NodeState }
export type PersonNode = Node<PersonNodeData, 'person'>

// Every generation sits on its own row, so y comes from the generation number
export function rankY(generation: number): number {
  return (generation - 1) * (NODE_HEIGHT + RANK_GAP)
}

type TreeItem = { person: Person | null; children: TreeItem[] }

// Top-to-bottom tidy tree (Reingold–Tilford): parents are centred over their
// children and subtrees pack by contour. Each person hangs under their first
// recorded parent; any further parent links are still drawn as edges.
// Multiple roots share an invisible super-root.
export function layoutTree({ persons, relationships }: TreeData): { nodes: PersonNode[]; edges: Edge[] } {
  const items = new Map(persons.map((p) => [p.id, { person: p, children: [] } as TreeItem]))
  const placed = new Set<number>()
  for (const { parentId, childId } of relationships) {
    const parent = items.get(parentId)
    const child = items.get(childId)
    if (!parent || !child || placed.has(childId) || parentId === childId) continue
    parent.children.push(child)
    placed.add(childId)
  }
  const root: TreeItem = { person: null, children: persons.filter((p) => !placed.has(p.id)).map((p) => items.get(p.id)!) }

  const laidOut = tree<TreeItem>()
    .nodeSize([NODE_WIDTH + SIBLING_GAP, NODE_HEIGHT + RANK_GAP])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.1))(
    hierarchy(root).sort((a, b) => (a.data.person?.id ?? 0) - (b.data.person?.id ?? 0))
  )

  const nodes: PersonNode[] = []
  laidOut.each(({ data, x }) => {
    if (!data.person) return
    nodes.push({
      id: String(data.person.id),
      type: 'person',
      position: { x: x - NODE_WIDTH / 2, y: rankY(data.person.generationNumber) },
      data: { person: data.person },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
  })

  const edges: Edge[] = relationships
    .filter(({ parentId, childId }) => items.has(parentId) && items.has(childId))
    .map(({ parentId, childId }) => ({
      id: `${parentId}-${childId}`,
      source: String(parentId),
      target: String(childId),
      type: 'smoothstep',
    }))

  return { nodes, edges }
}
