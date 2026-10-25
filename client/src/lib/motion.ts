export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Animation duration, or 0 when the user has asked for reduced motion
export const motionMs = (ms: number) => (prefersReducedMotion() ? 0 : ms)
