import { describe, expect, test } from 'vitest'
import { indexFamily, lineageOf, searchPersons } from './family'
import { fixture } from './fixture'

describe('indexFamily', () => {
  test('handles root and leaves', () => {
    const family = indexFamily(fixture)
    expect(family.byId.get(1)?.firstName).toBe('Deviram')
    expect(family.parentsOf.get(1) ?? []).toEqual([])
    expect((family.childrenOf.get(1) ?? []).map((p) => p.id)).toEqual([2, 3])
    expect((family.parentsOf.get(4) ?? []).map((p) => p.id)).toEqual([2])
    expect(family.childrenOf.get(4) ?? []).toEqual([])
  })
})

describe('lineageOf', () => {
  test('includes ancestors, self and descendants but not siblings', () => {
    const family = indexFamily(fixture)
    expect([...lineageOf(family, 2)].sort()).toEqual([1, 2, 4])
    expect([...lineageOf(family, 3)].sort()).toEqual([1, 3])
    expect([...lineageOf(family, 1)].sort()).toEqual([1, 2, 3, 4])
  })
})

describe('searchPersons', () => {
  test('is case-insensitive and partial', () => {
    expect(searchPersons(fixture.persons, 'ram').map((p) => p.id)).toEqual([1, 4])
    expect(searchPersons(fixture.persons, 'BHAGAT').map((p) => p.id)).toEqual([4])
  })

  test('returns nothing for empty or unmatched queries', () => {
    expect(searchPersons(fixture.persons, 'zzz')).toEqual([])
    expect(searchPersons(fixture.persons, '   ')).toEqual([])
  })

  test('respects the limit', () => {
    expect(searchPersons(fixture.persons, 'gupta', 2)).toHaveLength(2)
  })
})
