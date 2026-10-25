import { useStoreApi, type Edge } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import type { PersonNode } from '../lib/layout'
import { idsInRect, staggerDelays, visibleRect } from '../lib/viewport'

const MARGIN_PX = 40 // start revealing just before a card scrolls into view
const STAGGER_MS = 40
const EDGE_FOLLOW_MS = 450 // a line reaches out from a revealed parent toward unseen children
const SETTLE_MS = 1200 // longest reveal animation, after which an element renders static

// cards / lines: reveal delay (ms, relative to the batch) for everything seen so far.
// settled: ids whose reveal has finished, so re-mounting them never replays it.
export type Reveals = {
  cards: Map<string, number>
  lines: Map<string, number>
  settledCards: Set<string>
  settledLines: Set<string>
}

const empty = (): Reveals => ({ cards: new Map(), lines: new Map(), settledCards: new Set(), settledLines: new Set() })

// Reveals every card the first time it comes into view, and every line touching
// one. A line appears with whichever end shows first: drawn in alongside its
// child, or reaching out from its parent. Returns null when disabled (reduced
// motion), meaning "show everything".
export function useReveal(nodes: PersonNode[], edges: Edge[], enabled: boolean): Reveals | null {
  const store = useStoreApi()
  const [reveals, setReveals] = useState<Reveals>(empty)
  const seenCards = useRef(new Set<string>())
  const seenLines = useRef(new Set<string>())
  // settle timers outlive effect re-runs (new layout after a refetch); cleared on unmount
  const settleTimers = useRef<number[]>([])
  useEffect(() => {
    const timers = settleTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let frame = 0

    const check = () => {
      frame = 0
      const { transform, width, height } = store.getState()
      if (!width || !height) return
      const rect = visibleRect({ x: transform[0], y: transform[1], zoom: transform[2] }, { width, height }, MARGIN_PX)
      const fresh = idsInRect(nodes, rect).filter((id) => !seenCards.current.has(id))
      if (!fresh.length) return
      for (const id of fresh) seenCards.current.add(id)

      const cards = staggerDelays(nodes.filter((n) => fresh.includes(n.id)), STAGGER_MS)
      const lines = new Map<string, number>()
      for (const e of edges) {
        if (seenLines.current.has(e.id)) continue
        const child = cards.get(e.target)
        const parent = cards.get(e.source)
        if (child === undefined && parent === undefined) continue
        lines.set(e.id, child ?? parent! + EDGE_FOLLOW_MS)
        seenLines.current.add(e.id)
      }
      setReveals((prev) => ({ ...prev, cards: new Map([...prev.cards, ...cards]), lines: new Map([...prev.lines, ...lines]) }))

      const longest = Math.max(0, ...cards.values(), ...lines.values())
      settleTimers.current.push(
        window.setTimeout(
          () =>
            setReveals((prev) => ({
              ...prev,
              settledCards: new Set([...prev.settledCards, ...cards.keys()]),
              settledLines: new Set([...prev.settledLines, ...lines.keys()]),
            })),
          longest + SETTLE_MS
        )
      )
    }

    check()
    const unsubscribe = store.subscribe((state, prev) => {
      if ((state.transform !== prev.transform || state.width !== prev.width) && !frame) frame = requestAnimationFrame(check)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [store, nodes, edges, enabled])

  return enabled ? reveals : null
}
