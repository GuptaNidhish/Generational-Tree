import { useReactFlow } from '@xyflow/react'
import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { glideStep } from '../lib/viewport'

const EASE = 0.14 // share of the remaining distance covered per frame
const LINE_PX = 16 // wheel events reported in lines rather than pixels
const PINCH_MAX_DELTA = 40 // trackpad pinches arrive as small ctrl+wheel deltas; mouse notches are larger
const ZOOM_STEP = 1.2
const MIN_ZOOM = 0.05
const MAX_ZOOM = 2

// Wheel / trackpad scrolling moves the camera (instead of zooming) and eases
// into place. Pinch and ⌘ + wheel fall through to React Flow's zoom; Ctrl + mouse
// wheel zooms one gentle step per notch around the cursor.
export function useGlideScroll(container: RefObject<HTMLElement | null>, onScroll?: () => void) {
  const { getViewport, setViewport } = useReactFlow()

  useEffect(() => {
    const el = container.current
    if (!el) return

    let frame = 0
    let target = { x: 0, y: 0 }
    let lastSet: { x: number; y: number } | null = null

    const tick = () => {
      const current = getViewport()
      // someone else (drag, search fly-to) moved the camera: stop gliding
      if (lastSet && (current.x !== lastSet.x || current.y !== lastSet.y)) {
        frame = 0
        lastSet = null
        return
      }
      const next = { x: glideStep(current.x, target.x, EASE), y: glideStep(current.y, target.y, EASE), zoom: current.zoom }
      setViewport(next)
      lastSet = { x: next.x, y: next.y }
      frame = next.x === target.x && next.y === target.y ? 0 : requestAnimationFrame(tick)
      if (!frame) lastSet = null
    }

    const zoomStep = (e: WheelEvent) => {
      const { x, y, zoom } = getViewport()
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)))
      const bounds = el.getBoundingClientRect()
      const px = e.clientX - bounds.left
      const py = e.clientY - bounds.top
      // keep the point under the cursor fixed
      setViewport({ x: px - ((px - x) * next) / zoom, y: py - ((py - y) * next) / zoom, zoom: next }, { duration: prefersReducedMotion() ? 0 : 140 })
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey && Math.abs(e.deltaY) >= PINCH_MAX_DELTA) {
        e.preventDefault()
        e.stopPropagation()
        cancelAnimationFrame(frame)
        frame = 0
        zoomStep(e)
        return
      }
      if (e.ctrlKey || e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      onScroll?.()

      const scale = e.deltaMode === 1 ? LINE_PX : 1
      // a plain mouse wheel with Shift held scrolls sideways
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * scale
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * scale

      const base = frame ? target : getViewport()
      target = { x: base.x - dx, y: base.y - dy }

      if (prefersReducedMotion()) {
        setViewport({ ...target, zoom: getViewport().zoom })
        return
      }
      if (!frame) frame = requestAnimationFrame(tick)
    }

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true })
      cancelAnimationFrame(frame)
    }
  }, [container, getViewport, setViewport, onScroll])
}
