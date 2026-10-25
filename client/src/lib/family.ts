import type { Person, TreeData } from '../types'

export type FamilyIndex = {
  byId: Map<number, Person>
  parentsOf: Map<number, Person[]>
  childrenOf: Map<number, Person[]>
}

function push(map: Map<number, Person[]>, key: number, person: Person) {
  const list = map.get(key)
  if (list) list.push(person)
  else map.set(key, [person])
}

// Lookup tables for walking the tree in either direction
export function indexFamily({ persons, relationships }: TreeData): FamilyIndex {
  const byId = new Map(persons.map((p) => [p.id, p]))
  const parentsOf = new Map<number, Person[]>()
  const childrenOf = new Map<number, Person[]>()
  for (const { parentId, childId } of relationships) {
    const parent = byId.get(parentId)
    const child = byId.get(childId)
    if (!parent || !child) continue
    push(childrenOf, parentId, child)
    push(parentsOf, childId, parent)
  }
  return { byId, parentsOf, childrenOf }
}

// A person's bloodline: every ancestor up to the root, themselves, and every descendant
export function lineageOf(family: FamilyIndex, id: number): Set<number> {
  const lineage = new Set<number>([id])
  const walk = (start: number, next: Map<number, Person[]>) => {
    const stack = [start]
    while (stack.length) {
      for (const relative of next.get(stack.pop()!) ?? []) {
        if (lineage.has(relative.id)) continue
        lineage.add(relative.id)
        stack.push(relative.id)
      }
    }
  }
  walk(id, family.parentsOf)
  walk(id, family.childrenOf)
  return lineage
}

// Case-insensitive substring match on the display name
export function searchPersons(persons: Person[], query: string, limit = 8): Person[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return persons.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, limit)
}
