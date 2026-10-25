import { expect, test } from 'vitest'
import { layoutTree, NODE_WIDTH, rankY } from './layout'
import { fixture } from './fixture'
import type { TreeData } from '../types'

const xOf = (nodes: ReturnType<typeof layoutTree>['nodes'], id: string) => nodes.find((n) => n.id === id)!.position.x

test('layoutTree places each generation strictly below its parent', () => {
  const { nodes, edges } = layoutTree(fixture)
  expect(nodes).toHaveLength(fixture.persons.length)
  expect(edges).toHaveLength(fixture.relationships.length)

  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    expect(byId.get(edge.target)!.position.y).toBeGreaterThan(byId.get(edge.source)!.position.y)
  }
})

test('layoutTree puts everyone in a generation on the same row', () => {
  const { nodes } = layoutTree(fixture)
  for (const node of nodes) {
    expect(node.position.y).toBe(rankY(node.data.person.generationNumber))
  }
})

test('layoutTree does not overlap cards in a row', () => {
  const { nodes } = layoutTree(fixture)
  expect(Math.abs(xOf(nodes, '2') - xOf(nodes, '3'))).toBeGreaterThanOrEqual(NODE_WIDTH)
})

test('layoutTree centers a parent over its children', () => {
  const { nodes } = layoutTree(fixture)
  expect(xOf(nodes, '1')).toBeCloseTo((xOf(nodes, '2') + xOf(nodes, '3')) / 2)
})

test('layoutTree places people with several roots or a second parent', () => {
  const data: TreeData = {
    persons: [...fixture.persons, { ...fixture.persons[0], id: 9, displayName: 'Second root' }],
    relationships: [...fixture.relationships, { parentId: 9, childId: 4 }],
  }
  const { nodes, edges } = layoutTree(data)
  expect(nodes).toHaveLength(5)
  expect(edges).toHaveLength(4)
  expect(new Set(nodes.map((n) => `${n.position.x},${n.position.y}`)).size).toBe(5)
})
