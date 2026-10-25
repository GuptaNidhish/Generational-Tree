// Pure camera maths for the scroll-to-explore tree

export type Viewport = { x: number; y: number; zoom: number }
export type Size = { width: number; height: number }
export type Rect = { left: number; top: number; right: number; bottom: number }
export type Box = { id: string; position: { x: number; y: number }; width?: number; height?: number }

// The part of the flow currently on screen, padded by `margin` screen pixels
export function visibleRect({ x, y, zoom }: Viewport, { width, height }: Size, margin = 0): Rect {
  return {
    left: (-x - margin) / zoom,
    top: (-y - margin) / zoom,
    right: (width - x + margin) / zoom,
    bottom: (height - y + margin) / zoom,
  }
}

export function idsInRect(boxes: Box[], rect: Rect): string[] {
  return boxes
    .filter(({ position, width = 0, height = 0 }) =>
      position.x + width > rect.left && position.x < rect.right && position.y + height > rect.top && position.y < rect.bottom
    )
    .map((b) => b.id)
}

// One frame of an eased camera move: cover `factor` of the remaining distance
export function glideStep(current: number, target: number, factor: number): number {
  const next = current + (target - current) * factor
  return Math.abs(target - next) < 0.5 ? target : next
}

// Reveal delays for a batch: top-to-bottom, then left-to-right, `stepMs` apart,
// with the step shrunk so the whole batch starts within `maxMs`
export function staggerDelays(boxes: Box[], stepMs: number, maxMs = 1200): Map<string, number> {
  const ordered = [...boxes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  const step = ordered.length > 1 ? Math.min(stepMs, maxMs / (ordered.length - 1)) : 0
  return new Map(ordered.map((b, i) => [b.id, Math.round(i * step)]))
}
