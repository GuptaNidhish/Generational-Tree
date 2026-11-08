import { describe, expect, test } from 'vitest'
import type { TreeData } from '../types'
import { indexFamily } from './family'
import { fixture } from './fixture'
import { buildGenerations, honorific, siblingsOf, toRoman } from './generations'

describe('buildGenerations', () => {
  test('groups each generation into families under their parent', () => {
    const gens = buildGenerations(fixture, indexFamily(fixture))
    expect(gens.map((g) => g.number)).toEqual([1, 2, 3])
    expect(gens[0].families).toEqual([{ parent: null, children: [expect.objectContaining({ id: 1 })] }])
    expect(gens[1].families.map((f) => [f.parent?.id, f.children.map((c) => c.id)])).toEqual([[1, [2, 3]]])
    expect(gens[2].families.map((f) => [f.parent?.id, f.children.map((c) => c.id)])).toEqual([[2, [4]]])
    expect(gens.reduce((n, g) => n + g.members.length, 0)).toBe(fixture.persons.length)
  })

  test('orders families depth-first by their parent', () => {
    // 1 → 2, 3 ; 3 → 4 ; 2 → 5 (ids deliberately out of order)
    const p = (id: number, generationNumber: number) => ({ ...fixture.persons[0], id, generationNumber, displayName: `P${id}` })
    const data: TreeData = {
      persons: [p(1, 1), p(2, 2), p(3, 2), p(4, 3), p(5, 3)],
      relationships: [
        { parentId: 1, childId: 2 },
        { parentId: 1, childId: 3 },
        { parentId: 3, childId: 4 },
        { parentId: 2, childId: 5 },
      ],
    }
    const gen3 = buildGenerations(data, indexFamily(data))[2]
    expect(gen3.families.map((f) => f.parent?.id)).toEqual([2, 3])
    expect(gen3.members.map((m) => m.id)).toEqual([5, 4])
  })

  test('keeps people without a recorded parent, after the rooted families', () => {
    const p = (id: number, generationNumber: number) => ({ ...fixture.persons[0], id, generationNumber })
    const data: TreeData = { persons: [p(1, 1), p(2, 2), p(9, 2)], relationships: [{ parentId: 1, childId: 2 }] }
    const gen2 = buildGenerations(data, indexFamily(data))[1]
    expect(gen2.families.map((f) => [f.parent?.id ?? null, f.children.map((c) => c.id)])).toEqual([
      [1, [2]],
      [null, [9]],
    ])
  })
})

describe('siblingsOf', () => {
  test('returns the other children of the same parent', () => {
    const family = indexFamily(fixture)
    expect(siblingsOf(family, 2).map((p) => p.id)).toEqual([3])
    expect(siblingsOf(family, 4)).toEqual([])
    expect(siblingsOf(family, 1)).toEqual([])
  })
})

describe('toRoman', () => {
  test('converts small numbers', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9, 12].map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'IX', 'XII'])
  })
})

describe('honorific', () => {
  test('spells out the recorded salutation', () => {
    expect(honorific(fixture.persons[0])).toBe('Shri Deviram Gupta')
    expect(honorific({ ...fixture.persons[0], salutation: 'Smt', firstName: 'Kamla' })).toBe('Smt. Kamla Gupta')
    expect(honorific({ ...fixture.persons[0], salutation: null })).toBe('Deviram Gupta')
  })
})
