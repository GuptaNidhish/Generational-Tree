import type { Person, TreeData } from '../types'
import type { FamilyIndex } from './family'

// One sibling group: the children of `parent` who belong to a generation
export type Family = { parent: Person | null; children: Person[] }

export type Generation = {
  number: number
  members: Person[] // in display order (family by family)
  families: Family[]
}

// Every generation split into sibling groups. Families follow a depth-first walk
// from the root, so each branch keeps the same left-to-right place in every
// generation. People without a recorded parent come last in their generation.
export function buildGenerations({ persons }: TreeData, family: FamilyIndex): Generation[] {
  const byGeneration = new Map<number, Person[]>()
  for (const p of persons) {
    const list = byGeneration.get(p.generationNumber)
    if (list) list.push(p)
    else byGeneration.set(p.generationNumber, [p])
  }

  // Depth-first rank of every person, roots first
  const rank = new Map<number, number>()
  const roots = persons.filter((p) => !family.parentsOf.get(p.id)?.length)
  const stack = [...roots].reverse()
  while (stack.length) {
    const p = stack.pop()!
    if (rank.has(p.id)) continue
    rank.set(p.id, rank.size)
    const children = family.childrenOf.get(p.id) ?? []
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i])
  }
  const order = (p: Person) => rank.get(p.id) ?? Number.MAX_SAFE_INTEGER

  return [...byGeneration.keys()]
    .sort((a, b) => a - b)
    .map((number) => {
      const groups = new Map<number | null, Person[]>()
      const members = [...byGeneration.get(number)!].sort((a, b) => order(a) - order(b) || a.id - b.id)
      for (const p of members) {
        const parent = family.parentsOf.get(p.id)?.[0] ?? null
        const key = parent?.id ?? null
        const list = groups.get(key)
        if (list) list.push(p)
        else groups.set(key, [p])
      }
      const families: Family[] = [...groups].map(([parentId, children]) => ({
        parent: parentId === null ? null : family.byId.get(parentId)!,
        children,
      }))
      // A generation's own roots (no parent) go last, unless that is all there is
      const rooted = families.filter((f) => f.parent)
      const orphans = families.filter((f) => !f.parent)
      const ordered = rooted.length ? [...rooted, ...orphans] : orphans
      return { number, families: ordered, members: ordered.flatMap((f) => f.children) }
    })
}

export function siblingsOf(family: FamilyIndex, id: number): Person[] {
  const parent = family.parentsOf.get(id)?.[0]
  if (!parent) return []
  return (family.childrenOf.get(parent.id) ?? []).filter((p) => p.id !== id)
}

const ROMAN: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

export function toRoman(n: number): string {
  let out = ''
  for (const [value, glyph] of ROMAN) {
    while (n >= value) {
      out += glyph
      n -= value
    }
  }
  return out
}

const SPELLED: Record<string, string> = { sh: 'Shri', shri: 'Shri' }

// "Sh" → "Shri Deviram Gupta"; other salutations keep their abbreviation with a full stop
export function honorific({ salutation, firstName, middleName, surname }: Person): string {
  const key = salutation?.trim().replace(/\.$/, '') ?? ''
  const title = key ? (SPELLED[key.toLowerCase()] ?? `${key}.`) : ''
  return [title, firstName, middleName, surname].filter(Boolean).join(' ')
}

// "Son" / "Daughter" from the recorded gender, or null when it isn't recorded
export function childWord(gender: string): string | null {
  const g = gender.toLowerCase()
  return g === 'male' ? 'Son' : g === 'female' ? 'Daughter' : null
}

export const childrenLabel = (n: number) => `${n} ${n === 1 ? 'child' : 'children'}`
export const membersLabel = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`
