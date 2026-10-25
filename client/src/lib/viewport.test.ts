import { describe, expect, test } from 'vitest'
import { glideStep, idsInRect, staggerDelays, visibleRect } from './viewport'

const box = (id: string, x: number, y: number) => ({ id, position: { x, y }, width: 100, height: 50 })

describe('visibleRect', () => {
  test('converts the screen into flow coordinates', () => {
    // panned 200px right and 100px down at half zoom
    expect(visibleRect({ x: 200, y: 100, zoom: 0.5 }, { width: 1000, height: 600 })).toEqual({
      left: -400,
      top: -200,
      right: 1600,
      bottom: 1000,
    })
  })

  test('grows by a margin given in screen pixels', () => {
    expect(visibleRect({ x: 0, y: 0, zoom: 2 }, { width: 100, height: 100 }, 20)).toEqual({
      left: -10,
      top: -10,
      right: 60,
      bottom: 60,
    })
  })
})

describe('idsInRect', () => {
  test('includes boxes that overlap the rect at all, excludes the rest', () => {
    const rect = { left: 0, top: 0, right: 500, bottom: 300 }
    const nodes = [box('inside', 10, 10), box('edge', 480, 290), box('left', -150, 10), box('below', 10, 400)]
    expect(idsInRect(nodes, rect)).toEqual(['inside', 'edge'])
  })
})

describe('glideStep', () => {
  test('moves a fraction of the way toward the target', () => {
    expect(glideStep(0, 100, 0.2)).toBe(20)
    expect(glideStep(100, 0, 0.5)).toBe(50)
  })

  test('snaps when within half a pixel', () => {
    expect(glideStep(99.7, 100, 0.2)).toBe(100)
  })
})

describe('staggerDelays', () => {
  test('orders top-to-bottom then left-to-right', () => {
    const delays = staggerDelays([box('c', 0, 200), box('b', 300, 0), box('a', 0, 0)], 40)
    expect(delays).toEqual(new Map([['a', 0], ['b', 40], ['c', 80]]))
  })

  test('compresses the step so large batches finish within the cap', () => {
    const nodes = Array.from({ length: 101 }, (_, i) => box(String(i), i * 10, 0))
    const delays = staggerDelays(nodes, 40, 1000)
    expect(delays.get('100')).toBe(1000)
    expect(delays.get('50')).toBe(500)
  })
})
