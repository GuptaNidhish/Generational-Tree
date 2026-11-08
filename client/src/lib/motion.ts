const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches

export const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)')

// Animation duration, or 0 when the user has asked for reduced motion
export const motionMs = (ms: number) => (prefersReducedMotion() ? 0 : ms)

// Depth effects only where they are cheap and wanted: a mouse, a wide screen, motion allowed
export const canTilt = () => !prefersReducedMotion() && matches('(pointer: fine) and (min-width: 768px)')

export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth')
