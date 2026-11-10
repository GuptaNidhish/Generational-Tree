import type { Person } from '../types'
import type { FamilyIndex } from './family'

// Geometry for the hero illustration: the real family drawn as a tree.
// The eldest generation is the trunk; every later generation sits on a wider
// arc above it, and each person's share of the arc is proportional to the
// number of descendants they carry, so big branches get room to spread.

export const TREE_WIDTH = 1100
export const TREE_HEIGHT = 720
const ORIGIN = { x: TREE_WIDTH / 2, y: 610 }
const GROUND_Y = 712
// Distance from the origin for each generation (index 0 = eldest)
const RADII = [0, 150, 250, 330, 400, 465, 525, 580, 630]
const BRANCH_WIDTH = [11, 8, 6, 4.2, 3, 2.1, 1.5, 1.2, 1]
// Upward fan, in degrees (SVG y points down, so −90° is straight up)
const ARC_START = -160
const ARC_END = -20

export type Branch = { id: number; generation: number; d: string; width: number }
export type Leaf = { id: number; generation: number; x: number; y: number; angle: number; hasChildren: boolean }
export type TreeShape = { trunk: string; roots: string[]; branches: Branch[]; leaves: Leaf[] }

type Placed = { x: number; y: number; angle: number; radius: number }

const rad = (deg: number) => (deg * Math.PI) / 180
const r1 = (n: number) => Math.round(n * 10) / 10

export function growTree(family: FamilyIndex, persons: Person[]): TreeShape {
  const minGen = Math.min(...persons.map((p) => p.generationNumber))
  const radiusOf = (p: Person) => RADII[Math.min(p.generationNumber - minGen, RADII.length - 1)]
  const kids = (p: Person) => family.childrenOf.get(p.id) ?? []

  // Weight = number of leaves below (a leaf weighs 1)
  const weight = new Map<number, number>()
  const weigh = (p: Person, seen: Set<number>): number => {
    if (seen.has(p.id)) return 0
    seen.add(p.id)
    const w = kids(p).reduce((sum, c) => sum + weigh(c, seen), 0)
    weight.set(p.id, Math.max(1, w))
    return Math.max(1, w)
  }
  const roots = persons.filter((p) => !family.parentsOf.get(p.id)?.length)
  const seen = new Set<number>()
  roots.forEach((r) => weigh(r, seen))

  const placed = new Map<number, Placed>()
  const branches: Branch[] = []

  const place = (p: Person, from: number, to: number, parent: Placed | null) => {
    if (placed.has(p.id)) return
    const angle = (from + to) / 2
    // A lone root sits on the trunk; several roots share the first arc
    const radius = parent === null && roots.length === 1 ? 0 : Math.max(radiusOf(p), parent ? parent.radius + 60 : 60)
    const x = ORIGIN.x + Math.cos(rad(angle)) * radius
    const y = ORIGIN.y + Math.sin(rad(angle)) * radius
    const self = { x, y, angle, radius }
    placed.set(p.id, self)

    if (parent) {
      // Leave the parent along its own heading, arrive along the child's
      const reach = radius - parent.radius
      const out = parent.radius === 0 ? -90 : parent.angle
      const c1x = parent.x + Math.cos(rad(out)) * reach * 0.5
      const c1y = parent.y + Math.sin(rad(out)) * reach * 0.5
      const c2x = x - Math.cos(rad(angle)) * reach * 0.42
      const c2y = y - Math.sin(rad(angle)) * reach * 0.42
      const depth = Math.min(p.generationNumber - minGen, BRANCH_WIDTH.length - 1)
      branches.push({
        id: p.id,
        generation: p.generationNumber,
        d: `M${r1(parent.x)} ${r1(parent.y)}C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(x)} ${r1(y)}`,
        width: BRANCH_WIDTH[depth],
      })
    }

    const children = kids(p)
    const total = children.reduce((s, c) => s + (weight.get(c.id) ?? 1), 0)
    let cursor = from
    for (const c of children) {
      const span = ((to - from) * (weight.get(c.id) ?? 1)) / total
      place(c, cursor, cursor + span, self)
      cursor += span
    }
  }

  const rootTotal = roots.reduce((s, r) => s + (weight.get(r.id) ?? 1), 0)
  let cursor = ARC_START
  for (const r of roots) {
    const span = ((ARC_END - ARC_START) * (weight.get(r.id) ?? 1)) / rootTotal
    place(r, cursor, cursor + span, null)
    cursor += span
  }

  const leaves: Leaf[] = persons
    .filter((p) => placed.has(p.id))
    .map((p) => {
      const { x, y, angle } = placed.get(p.id)!
      return { id: p.id, generation: p.generationNumber, x: r1(x), y: r1(y), angle: r1(angle), hasChildren: kids(p).length > 0 }
    })

  // A tapering trunk from the ground to the eldest ancestor, with a few roots
  const { x, y } = ORIGIN
  const trunk = `M${x - 26} ${GROUND_Y}C${x - 14} ${y + 60} ${x - 9} ${y + 24} ${x - 5} ${y}L${x + 5} ${y}C${x + 9} ${y + 24} ${x + 14} ${y + 60} ${x + 26} ${GROUND_Y}Z`
  const rootLines = [
    `M${x - 20} ${GROUND_Y - 4}C${x - 60} ${GROUND_Y} ${x - 110} ${GROUND_Y + 2} ${x - 170} ${GROUND_Y + 6}`,
    `M${x - 12} ${GROUND_Y - 2}C${x - 30} ${GROUND_Y + 4} ${x - 50} ${GROUND_Y + 6} ${x - 80} ${GROUND_Y + 8}`,
    `M${x + 20} ${GROUND_Y - 4}C${x + 60} ${GROUND_Y} ${x + 110} ${GROUND_Y + 2} ${x + 170} ${GROUND_Y + 6}`,
    `M${x + 12} ${GROUND_Y - 2}C${x + 30} ${GROUND_Y + 4} ${x + 50} ${GROUND_Y + 6} ${x + 80} ${GROUND_Y + 8}`,
  ]

  return { trunk, roots: rootLines, branches, leaves }
}
