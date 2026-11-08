import { expect, test } from 'vitest'
import { indexFamily } from './family'
import { fixture } from './fixture'
import { growTree, TREE_HEIGHT, TREE_WIDTH } from './treeShape'

test('draws one branch per parent link and one leaf per person, inside the canvas', () => {
  const shape = growTree(indexFamily(fixture), fixture.persons)
  expect(shape.branches.map((b) => b.id).sort()).toEqual([2, 3, 4])
  expect(shape.leaves).toHaveLength(fixture.persons.length)
  for (const { x, y } of shape.leaves) {
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThanOrEqual(TREE_WIDTH)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(TREE_HEIGHT)
  }
})

test('the root sits on the trunk and children rise above their parent', () => {
  const shape = growTree(indexFamily(fixture), fixture.persons)
  const at = (id: number) => shape.leaves.find((l) => l.id === id)!
  expect(at(1).x).toBe(TREE_WIDTH / 2)
  expect(at(2).y).toBeLessThan(at(1).y)
  expect(at(4).y).toBeLessThan(at(2).y)
  // the elder child (listed first) grows to the left
  expect(at(2).x).toBeLessThan(at(3).x)
})
